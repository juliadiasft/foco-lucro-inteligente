import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { BaseUnit } from "../catalog";
import { requireActiveSession, type SessionUser } from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { sendCompanyPush } from "../server/push.server";

export type QuoteStatus =
  "aberto" | "respondido" | "negociando" | "aceito" | "recusado" | "cancelado";

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  aberto: "Aguardando o fornecedor",
  respondido: "Proposta recebida",
  negociando: "Em negociação",
  aceito: "Fechado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

async function requireParticipant(user: SessionUser, quoteId: string) {
  const result = await query<{
    id: string;
    merchant_company_id: string;
    supplier_company_id: string;
    status: QuoteStatus;
  }>(
    `SELECT id,merchant_company_id,supplier_company_id,status FROM quote_requests
      WHERE id=$1 AND (merchant_company_id=$2 OR supplier_company_id=$2)`,
    [quoteId, user.companyId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Orçamento não encontrado");
  return row;
}

export const createQuoteRequest = createServerFn({ method: "POST" })
  .validator(
    z.object({
      supplierCompanyId: z.string().uuid(),
      note: z.string().trim().max(600).optional(),
      items: z
        .array(
          z.object({
            offeringId: z.string().uuid().optional(),
            itemName: z.string().trim().min(1).max(180),
            brand: z.string().trim().max(80).optional(),
            baseUnit: z.enum(["kg", "l", "un"]),
            packSize: z.number().positive().max(1000000).optional(),
            quantity: z.number().positive().max(1000000),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    if (user.accountType !== "comerciante") throw new Error("Apenas o comerciante pede orçamento");

    const quoteId = await transaction(async (client) => {
      const supplier = await client.query<{ id: string }>(
        `SELECT c.id FROM companies c
           JOIN supplier_profiles sp ON sp.company_id=c.id AND sp.published=true
          WHERE c.id=$1 AND c.account_type='fornecedor'`,
        [data.supplierCompanyId],
      );
      if (!supplier.rows[0]) throw new Error("Fornecedor não encontrado");

      const quote = await client.query<{ id: string }>(
        `INSERT INTO quote_requests (merchant_company_id,supplier_company_id,note,created_by)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [user.companyId, data.supplierCompanyId, data.note || null, user.id],
      );
      for (const item of data.items) {
        await client.query(
          `INSERT INTO quote_request_items
             (quote_request_id,offering_id,item_name,brand,base_unit,pack_size,quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            quote.rows[0].id,
            item.offeringId || null,
            item.itemName,
            item.brand || null,
            item.baseUnit,
            item.packSize ?? null,
            item.quantity,
          ],
        );
      }
      return quote.rows[0].id;
    });

    void sendCompanyPush(data.supplierCompanyId, {
      title: `Novo pedido de orçamento de ${user.companyName}`,
      body: "Abra a Central para enviar sua proposta.",
      // Direto no orçamento: quem toca na notificação quer responder, e não
      // procurar na lista qual dos pedidos é o novo.
      url: `/fornecedor/orcamentos?aberto=${quoteId}`,
      tag: `orcamento:${quoteId}`,
    }).catch((error) => console.error("Falha ao notificar orçamento", error));

    return { id: quoteId };
  });

export const listQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const isMerchant = user.accountType === "comerciante";
  const result = await query<{
    id: string;
    status: QuoteStatus;
    note: string | null;
    created_at: Date;
    counterpart_name: string;
    itens: string;
    ultimo_total: string | null;
    ultima_origem: string | null;
  }>(
    `SELECT q.id,q.status,q.note,q.created_at,
            coalesce(sp.display_name, other.name) counterpart_name,
            (SELECT count(*) FROM quote_request_items i
              WHERE i.quote_request_id=q.id)::text itens,
            (SELECT p.total::text FROM quote_proposals p
              WHERE p.quote_request_id=q.id ORDER BY p.created_at DESC LIMIT 1) ultimo_total,
            (SELECT p.from_company_id::text FROM quote_proposals p
              WHERE p.quote_request_id=q.id ORDER BY p.created_at DESC LIMIT 1) ultima_origem
       FROM quote_requests q
       JOIN companies other
         ON other.id = CASE WHEN $2::boolean THEN q.supplier_company_id
                            ELSE q.merchant_company_id END
       LEFT JOIN supplier_profiles sp ON sp.company_id = other.id
      WHERE ($2::boolean AND q.merchant_company_id=$1)
         OR (NOT $2::boolean AND q.supplier_company_id=$1)
      ORDER BY q.updated_at DESC
      LIMIT 100`,
    [user.companyId, isMerchant],
  );
  return {
    side: isMerchant ? ("comerciante" as const) : ("fornecedor" as const),
    quotes: result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      note: row.note,
      createdAt: row.created_at.toISOString(),
      counterpartName: row.counterpart_name,
      itens: Number(row.itens),
      ultimoTotal: row.ultimo_total === null ? null : Number(row.ultimo_total),
      // Diz de quem foi a última palavra: é isso que define quem precisa
      // responder agora.
      minhaVez: row.ultima_origem !== null && row.ultima_origem !== user.companyId,
    })),
  };
});

export const getQuote = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const quote = await requireParticipant(user, data.id);

    const [items, proposals, proposalItems, counterpart] = await Promise.all([
      query<{
        id: string;
        item_name: string;
        brand: string | null;
        base_unit: BaseUnit;
        pack_size: string | null;
        quantity: string;
      }>(
        `SELECT id,item_name,brand,base_unit,pack_size,quantity
           FROM quote_request_items WHERE quote_request_id=$1 ORDER BY item_name`,
        [data.id],
      ),
      query<{
        id: string;
        from_company_id: string;
        kind: string;
        total: string;
        delivery_days: number | null;
        payment_terms: string | null;
        note: string | null;
        status: string;
        created_at: Date;
      }>(
        `SELECT id,from_company_id,kind,total,delivery_days,payment_terms,note,status,created_at
           FROM quote_proposals WHERE quote_request_id=$1 ORDER BY created_at`,
        [data.id],
      ),
      query<{
        proposal_id: string;
        request_item_id: string | null;
        item_name: string;
        base_unit: BaseUnit;
        pack_size: string;
        quantity: string;
        unit_price: string;
        subtotal: string;
      }>(
        `SELECT pi.proposal_id,pi.request_item_id,pi.item_name,pi.base_unit,pi.pack_size,
                pi.quantity,pi.unit_price,pi.subtotal
           FROM quote_proposal_items pi
           JOIN quote_proposals p ON p.id=pi.proposal_id
          WHERE p.quote_request_id=$1
          ORDER BY pi.item_name`,
        [data.id],
      ),
      query<{ name: string; city: string | null; uf: string | null }>(
        `SELECT coalesce(sp.display_name, c.name) name, c.city, c.uf
           FROM companies c LEFT JOIN supplier_profiles sp ON sp.company_id=c.id
          WHERE c.id=$1`,
        [
          quote.merchant_company_id === user.companyId
            ? quote.supplier_company_id
            : quote.merchant_company_id,
        ],
      ),
    ]);

    return {
      id: quote.id,
      status: quote.status,
      side: user.accountType,
      counterpartName: counterpart.rows[0]?.name || "",
      city: counterpart.rows[0]?.city || null,
      uf: counterpart.rows[0]?.uf || null,
      items: items.rows.map((row) => ({
        id: row.id,
        itemName: row.item_name,
        brand: row.brand,
        baseUnit: row.base_unit,
        packSize: row.pack_size === null ? null : Number(row.pack_size),
        quantity: Number(row.quantity),
      })),
      proposals: proposals.rows.map((row) => ({
        id: row.id,
        mine: row.from_company_id === user.companyId,
        kind: row.kind,
        total: Number(row.total),
        deliveryDays: row.delivery_days,
        paymentTerms: row.payment_terms,
        note: row.note,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        items: proposalItems.rows
          .filter((item) => item.proposal_id === row.id)
          .map((item) => ({
            requestItemId: item.request_item_id,
            itemName: item.item_name,
            baseUnit: item.base_unit,
            packSize: Number(item.pack_size),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            subtotal: Number(item.subtotal),
          })),
      })),
    };
  });

export const sendProposal = createServerFn({ method: "POST" })
  .validator(
    z.object({
      quoteId: z.string().uuid(),
      deliveryDays: z.number().int().min(0).max(365).nullable().optional(),
      paymentTerms: z.string().trim().max(200).optional(),
      note: z.string().trim().max(600).optional(),
      items: z
        .array(
          z.object({
            requestItemId: z.string().uuid(),
            itemName: z.string().trim().min(1).max(180),
            baseUnit: z.enum(["kg", "l", "un"]),
            packSize: z.number().positive().max(1000000),
            quantity: z.number().positive().max(1000000),
            unitPrice: z.number().min(0).max(9999999),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const quote = await requireParticipant(user, data.quoteId);
    if (quote.status === "aceito" || quote.status === "cancelado" || quote.status === "recusado")
      throw new Error("Esta negociação já foi encerrada");

    // Fornecedor propõe, comerciante contrapropõe. O tipo não vem do cliente:
    // é decidido pelo lado de quem está enviando.
    const kind = user.accountType === "fornecedor" ? "proposta" : "contraproposta";
    const total = data.items.reduce((soma, item) => soma + item.unitPrice * item.quantity, 0);

    const proposalId = await transaction(async (client) => {
      // A rodada anterior deixa de valer assim que alguém responde.
      await client.query(
        "UPDATE quote_proposals SET status='superada' WHERE quote_request_id=$1 AND status='enviada'",
        [data.quoteId],
      );
      const proposal = await client.query<{ id: string }>(
        `INSERT INTO quote_proposals
           (quote_request_id,from_company_id,kind,total,delivery_days,payment_terms,note,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          data.quoteId,
          user.companyId,
          kind,
          total,
          data.deliveryDays ?? null,
          data.paymentTerms || null,
          data.note || null,
          user.id,
        ],
      );
      for (const item of data.items) {
        await client.query(
          `INSERT INTO quote_proposal_items
             (proposal_id,request_item_id,item_name,base_unit,pack_size,quantity,unit_price,subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            proposal.rows[0].id,
            item.requestItemId,
            item.itemName,
            item.baseUnit,
            item.packSize,
            item.quantity,
            item.unitPrice,
            item.unitPrice * item.quantity,
          ],
        );
      }
      await client.query("UPDATE quote_requests SET status=$2,updated_at=now() WHERE id=$1", [
        data.quoteId,
        kind === "proposta" ? "respondido" : "negociando",
      ]);
      return proposal.rows[0].id;
    });

    const destino =
      user.companyId === quote.merchant_company_id
        ? quote.supplier_company_id
        : quote.merchant_company_id;
    void sendCompanyPush(destino, {
      title: kind === "proposta" ? "Proposta recebida" : "Contraproposta recebida",
      body: `${user.companyName} respondeu seu orçamento.`,
      url: user.accountType === "fornecedor" ? "/orcamentos" : "/fornecedor/orcamentos",
      tag: `orcamento:${data.quoteId}`,
    }).catch((error) => console.error("Falha ao notificar proposta", error));

    return { id: proposalId };
  });

export const acceptProposal = createServerFn({ method: "POST" })
  .validator(z.object({ quoteId: z.string().uuid(), proposalId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const quote = await requireParticipant(user, data.quoteId);
    if (quote.status === "aceito") throw new Error("Esta negociação já foi fechada");

    const orderId = await transaction(async (client) => {
      const proposal = await client.query<{
        id: string;
        from_company_id: string;
        total: string;
        status: string;
      }>(
        `SELECT id,from_company_id,total,status FROM quote_proposals
          WHERE id=$1 AND quote_request_id=$2`,
        [data.proposalId, data.quoteId],
      );
      const row = proposal.rows[0];
      if (!row) throw new Error("Proposta não encontrada");
      if (row.status !== "enviada") throw new Error("Esta proposta não é mais a mais recente");
      // Quem propôs não aceita a própria proposta.
      if (row.from_company_id === user.companyId)
        throw new Error("Aguarde a outra parte responder");

      const items = await client.query<{
        item_name: string;
        base_unit: string;
        pack_size: string;
        quantity: string;
        unit_price: string;
        subtotal: string;
        offering_id: string | null;
      }>(
        `SELECT item_name,base_unit,pack_size,quantity,unit_price,subtotal,offering_id
           FROM quote_proposal_items WHERE proposal_id=$1`,
        [data.proposalId],
      );

      const order = await client.query<{ id: string }>(
        `INSERT INTO purchase_orders
           (merchant_company_id,supplier_company_id,total,note,created_by,quote_proposal_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          quote.merchant_company_id,
          quote.supplier_company_id,
          Number(row.total),
          "Pedido gerado a partir de orçamento negociado na Central",
          user.id,
          data.proposalId,
        ],
      );
      for (const item of items.rows) {
        await client.query(
          `INSERT INTO purchase_order_items
             (order_id,offering_id,item_name,base_unit,pack_size,quantity,unit_price,subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            order.rows[0].id,
            item.offering_id,
            item.item_name,
            item.base_unit,
            Number(item.pack_size),
            Number(item.quantity),
            Number(item.unit_price),
            Number(item.subtotal),
          ],
        );
      }

      await client.query("UPDATE quote_proposals SET status='aceita' WHERE id=$1", [
        data.proposalId,
      ]);
      await client.query("UPDATE quote_requests SET status='aceito',updated_at=now() WHERE id=$1", [
        data.quoteId,
      ]);
      return order.rows[0].id;
    });

    const destino =
      user.companyId === quote.merchant_company_id
        ? quote.supplier_company_id
        : quote.merchant_company_id;
    void sendCompanyPush(destino, {
      title: "Proposta aceita",
      body: `${user.companyName} fechou o orçamento. O pedido já foi criado.`,
      url: user.accountType === "fornecedor" ? "/fornecedor/pedidos" : "/pedidos",
      tag: `pedido:${orderId}`,
    }).catch((error) => console.error("Falha ao notificar aceite", error));

    return { orderId };
  });

export const closeQuote = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["recusado", "cancelado"]),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const quote = await requireParticipant(user, data.id);
    if (quote.status === "aceito") throw new Error("Esta negociação já foi fechada");
    // Cancelar é do comerciante, que abriu; recusar é do fornecedor.
    const permitido =
      data.status === "cancelado"
        ? user.companyId === quote.merchant_company_id
        : user.companyId === quote.supplier_company_id;
    if (!permitido) throw new Error("Você não pode encerrar este orçamento desta forma");
    await query("UPDATE quote_requests SET status=$2,updated_at=now() WHERE id=$1", [
      data.id,
      data.status,
    ]);
    return { ok: true };
  });
