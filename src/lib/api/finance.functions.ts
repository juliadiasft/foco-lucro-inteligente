import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { hojeEmBrasilia } from "../format";
import { requireActiveSession } from "../server/auth.server";
import { query, type DatabaseClient } from "../server/db.server";

export type FinanceDirection = "pagar" | "receber";

// Chamado quando o fornecedor aceita o pedido. Cria a conta dos dois lados de
// uma vez: sem isso, o dinheiro combinado na Central não apareceria em lugar
// nenhum e o comerciante continuaria controlando pagamento no caderno.
export async function createOrderFinanceEntries(client: DatabaseClient, orderId: string) {
  const order = await client.query<{
    merchant_company_id: string;
    supplier_company_id: string;
    total: string;
    merchant_name: string;
    supplier_name: string;
  }>(
    `SELECT o.merchant_company_id, o.supplier_company_id, o.total,
            m.name merchant_name,
            coalesce(sp.display_name, s.name) supplier_name
       FROM purchase_orders o
       JOIN companies m ON m.id = o.merchant_company_id
       JOIN companies s ON s.id = o.supplier_company_id
       LEFT JOIN supplier_profiles sp ON sp.company_id = s.id
      WHERE o.id = $1`,
    [orderId],
  );
  const row = order.rows[0];
  if (!row) return;

  await client.query(
    `INSERT INTO finance_entries
       (company_id,counterparty_company_id,counterparty_name,order_id,direction,description,amount)
     VALUES ($1,$2,$3,$4,'pagar',$5,$6)
     ON CONFLICT (order_id, company_id) WHERE order_id IS NOT NULL DO NOTHING`,
    [
      row.merchant_company_id,
      row.supplier_company_id,
      row.supplier_name,
      orderId,
      `Pedido para ${row.supplier_name}`,
      Number(row.total),
    ],
  );
  await client.query(
    `INSERT INTO finance_entries
       (company_id,counterparty_company_id,counterparty_name,order_id,direction,description,amount)
     VALUES ($1,$2,$3,$4,'receber',$5,$6)
     ON CONFLICT (order_id, company_id) WHERE order_id IS NOT NULL DO NOTHING`,
    [
      row.supplier_company_id,
      row.merchant_company_id,
      row.merchant_name,
      orderId,
      `Venda para ${row.merchant_name}`,
      Number(row.total),
    ],
  );
}

// Chamado quando o comerciante cancela um pedido que o fornecedor já tinha
// aceito. Até 14/09/2026 o cancelamento deixava as duas contas de pé: o
// comerciante via uma conta a pagar de mercadoria que não vai chegar, e o
// fornecedor uma conta a receber que ninguém vai pagar.
//
// As contas só saem se NENHUM dos dois lados registrou pagamento. Se o
// comerciante já marcou como pago, o dinheiro mudou de mão e precisa de acerto:
// apagar a conta a receber do fornecedor esconderia justamente o valor que ele
// tem de devolver. Nesse caso as duas ficam, e a pendência continua à vista.
export async function removeUnpaidOrderFinanceEntries(client: DatabaseClient, orderId: string) {
  await client.query(
    `DELETE FROM finance_entries
      WHERE order_id=$1
        AND NOT EXISTS (
          SELECT 1 FROM finance_entries paga WHERE paga.order_id=$1 AND paga.paid_at IS NOT NULL
        )`,
    [orderId],
  );
}

function directionFor(accountType: string): FinanceDirection {
  return accountType === "fornecedor" ? "receber" : "pagar";
}

export const listFinance = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const direction = directionFor(user.accountType);
  // Uma fonte só de "hoje" para a consulta e para a conta de "vencida" abaixo.
  const hoje = hojeEmBrasilia();

  const [entries, totals] = await Promise.all([
    query<{
      id: string;
      counterparty_name: string | null;
      order_id: string | null;
      description: string;
      amount: string;
      due_date: Date | null;
      paid_at: Date | null;
      paid_amount: string | null;
      note: string | null;
    }>(
      `SELECT id,counterparty_name,order_id,description,amount,due_date,paid_at,paid_amount,note
         FROM finance_entries
        WHERE company_id=$1 AND direction=$2
        ORDER BY paid_at IS NOT NULL, due_date NULLS LAST, created_at DESC
        LIMIT 300`,
      [user.companyId, direction],
    ),
    // "Hoje" é o de Brasília ($3), e não o current_date do banco, que roda em
    // UTC: das 21h à meia-noite ele já é amanhã, e a conta que vence hoje era
    // somada em "Vencido" três horas antes do dia acabar.
    query<{
      aberto: string;
      vencido: string;
      proximos: string;
      sem_data: string;
      pago_mes: string;
    }>(
      `SELECT coalesce(sum(amount) FILTER (WHERE paid_at IS NULL),0)::text aberto,
              coalesce(sum(amount) FILTER (
                WHERE paid_at IS NULL AND due_date IS NOT NULL AND due_date < $3::date),0)::text vencido,
              coalesce(sum(amount) FILTER (
                WHERE paid_at IS NULL AND due_date BETWEEN $3::date AND $3::date + 7),0)::text proximos,
              coalesce(sum(amount) FILTER (WHERE paid_at IS NULL AND due_date IS NULL),0)::text sem_data,
              coalesce(sum(coalesce(paid_amount, amount)) FILTER (
                WHERE paid_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                                   AT TIME ZONE 'America/Sao_Paulo'),0)::text pago_mes
         FROM finance_entries WHERE company_id=$1 AND direction=$2`,
      [user.companyId, direction, hoje],
    ),
  ]);

  return {
    direction,
    totals: {
      aberto: Number(totals.rows[0].aberto),
      vencido: Number(totals.rows[0].vencido),
      proximos: Number(totals.rows[0].proximos),
      semData: Number(totals.rows[0].sem_data),
      pagoNoMes: Number(totals.rows[0].pago_mes),
    },
    entries: entries.rows.map((row) => {
      const dueDate = row.due_date ? row.due_date.toISOString().slice(0, 10) : null;
      return {
        id: row.id,
        counterpartyName: row.counterparty_name,
        fromOrder: row.order_id !== null,
        description: row.description,
        amount: Number(row.amount),
        dueDate,
        paidAt: row.paid_at ? row.paid_at.toISOString() : null,
        paidAmount: row.paid_amount === null ? null : Number(row.paid_amount),
        note: row.note,
        vencida: row.paid_at === null && dueDate !== null && dueDate < hoje,
      };
    }),
  };
});

export const saveFinanceEntry = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().optional(),
      description: z.string().trim().min(1).max(200),
      counterpartyName: z.string().trim().max(160).optional(),
      amount: z.number().min(0).max(99999999),
      dueDate: z.string().trim().max(10).optional(),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const direction = directionFor(user.accountType);

    if (data.id) {
      // Conta vinda de pedido tem valor e contraparte definidos pela
      // negociação: aqui só o vencimento e a observação podem mudar.
      const updated = await query<{ id: string }>(
        `UPDATE finance_entries
            SET description = CASE WHEN order_id IS NULL THEN $3 ELSE description END,
                counterparty_name = CASE WHEN order_id IS NULL THEN $4 ELSE counterparty_name END,
                amount = CASE WHEN order_id IS NULL THEN $5 ELSE amount END,
                due_date=$6, note=$7, updated_at=now()
          WHERE id=$1 AND company_id=$2 RETURNING id`,
        [
          data.id,
          user.companyId,
          data.description,
          data.counterpartyName || null,
          data.amount,
          data.dueDate || null,
          data.note || null,
        ],
      );
      if (!updated.rows[0]) throw new Error("Conta não encontrada");
      return { ok: true };
    }

    await query(
      `INSERT INTO finance_entries
         (company_id,counterparty_name,direction,description,amount,due_date,note,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        user.companyId,
        data.counterpartyName || null,
        direction,
        data.description,
        data.amount,
        data.dueDate || null,
        data.note || null,
        user.id,
      ],
    );
    return { ok: true };
  });

export const settleFinanceEntry = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      paid: z.boolean(),
      paidAmount: z.number().min(0).max(99999999).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const updated = await query<{ id: string }>(
      `UPDATE finance_entries
          SET paid_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
              paid_amount = CASE WHEN $3::boolean THEN coalesce($4, amount) ELSE NULL END,
              updated_at = now()
        WHERE id=$1 AND company_id=$2 RETURNING id`,
      [data.id, user.companyId, data.paid, data.paidAmount ?? null],
    );
    if (!updated.rows[0]) throw new Error("Conta não encontrada");
    return { ok: true };
  });

export const removeFinanceEntry = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    // Conta gerada por pedido não é apagada: ela é o registro do que foi
    // combinado na plataforma.
    const removed = await query<{ id: string }>(
      "DELETE FROM finance_entries WHERE id=$1 AND company_id=$2 AND order_id IS NULL RETURNING id",
      [data.id, user.companyId],
    );
    if (!removed.rows[0])
      throw new Error("Contas geradas por pedido não podem ser excluídas, apenas quitadas.");
    return { ok: true };
  });
