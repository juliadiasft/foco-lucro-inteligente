import { createServerFn } from "@tanstack/react-start";

import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

// Serie dos ultimos 6 meses. Sem biblioteca de grafico: uma barra desenhada
// com div resolve, funciona no celular e nao acrescenta peso ao pacote.
const EVOLUCAO_SQL = (coluna: string) => `
  WITH meses AS (
    SELECT generate_series(
             date_trunc('month', now()) - interval '5 months',
             date_trunc('month', now()),
             interval '1 month') AS mes
  )
  SELECT to_char(m.mes, 'MM/YYYY') rotulo,
         coalesce(sum(o.total), 0)::text valor,
         count(o.id)::text pedidos
    FROM meses m
    LEFT JOIN purchase_orders o
      ON date_trunc('month', o.created_at) = m.mes
     AND o.${coluna} = $1
     AND o.status IN ('aceito', 'concluido')
   GROUP BY m.mes
   ORDER BY m.mes`;

async function loadInsights(companyId: string, isMerchant: boolean) {
  const coluna = isMerchant ? "merchant_company_id" : "supplier_company_id";
  const outraColuna = isMerchant ? "supplier_company_id" : "merchant_company_id";
  const direction = isMerchant ? "pagar" : "receber";

  const [totais, pedidos, evolucao, topItens, topParceiros, financeiro, orcamentos] =
    await Promise.all([
      query<{ total: string; mes: string; ticket: string }>(
        `SELECT coalesce(sum(total),0)::text total,
                coalesce(sum(total) FILTER (WHERE created_at >= date_trunc('month',now())),0)::text mes,
                coalesce(avg(total),0)::text ticket
           FROM purchase_orders
          WHERE ${coluna}=$1 AND status IN ('aceito','concluido')`,
        [companyId],
      ),
      query<{ andamento: string; concluidos: string; novos: string }>(
        `SELECT count(*) FILTER (WHERE status='aceito')::text andamento,
                count(*) FILTER (WHERE status='concluido')::text concluidos,
                count(*) FILTER (WHERE status='enviado')::text novos
           FROM purchase_orders WHERE ${coluna}=$1`,
        [companyId],
      ),
      query<{ rotulo: string; valor: string; pedidos: string }>(EVOLUCAO_SQL(coluna), [companyId]),
      query<{ nome: string; quantidade: string; valor: string }>(
        `SELECT i.item_name nome, sum(i.quantity)::text quantidade, sum(i.subtotal)::text valor
           FROM purchase_order_items i
           JOIN purchase_orders o ON o.id=i.order_id
          WHERE o.${coluna}=$1 AND o.status IN ('aceito','concluido')
          GROUP BY i.item_name ORDER BY sum(i.subtotal) DESC LIMIT 5`,
        [companyId],
      ),
      query<{ nome: string; pedidos: string; valor: string }>(
        `SELECT coalesce(sp.display_name, c.name) nome,
                count(*)::text pedidos, sum(o.total)::text valor
           FROM purchase_orders o
           JOIN companies c ON c.id = o.${outraColuna}
           LEFT JOIN supplier_profiles sp ON sp.company_id = c.id
          WHERE o.${coluna}=$1 AND o.status IN ('aceito','concluido')
          GROUP BY c.id, coalesce(sp.display_name, c.name)
          ORDER BY sum(o.total) DESC LIMIT 5`,
        [companyId],
      ),
      query<{ aberto: string; vencido: string }>(
        `SELECT coalesce(sum(amount) FILTER (WHERE paid_at IS NULL),0)::text aberto,
                coalesce(sum(amount) FILTER (
                  WHERE paid_at IS NULL AND due_date IS NOT NULL AND due_date < current_date),0)::text vencido
           FROM finance_entries WHERE company_id=$1 AND direction=$2`,
        [companyId, direction],
      ),
      query<{ pendentes: string }>(
        `SELECT count(*)::text pendentes FROM quote_requests
          WHERE ${coluna}=$1 AND status IN ('aberto','respondido','negociando')`,
        [companyId],
      ),
    ]);

  const serie = evolucao.rows.map((row) => ({
    rotulo: row.rotulo,
    valor: Number(row.valor),
    pedidos: Number(row.pedidos),
  }));

  return {
    total: Number(totais.rows[0].total),
    mes: Number(totais.rows[0].mes),
    ticket: Number(totais.rows[0].ticket),
    pedidosNovos: Number(pedidos.rows[0].novos),
    pedidosAndamento: Number(pedidos.rows[0].andamento),
    pedidosConcluidos: Number(pedidos.rows[0].concluidos),
    evolucao: serie,
    // O maior valor da série serve de escala para as barras.
    maiorDaSerie: serie.reduce((maior, item) => Math.max(maior, item.valor), 0),
    topItens: topItens.rows.map((row) => ({
      nome: row.nome,
      quantidade: Number(row.quantidade),
      valor: Number(row.valor),
    })),
    topParceiros: topParceiros.rows.map((row) => ({
      nome: row.nome,
      pedidos: Number(row.pedidos),
      valor: Number(row.valor),
    })),
    financeiro: {
      aberto: Number(financeiro.rows[0].aberto),
      vencido: Number(financeiro.rows[0].vencido),
    },
    orcamentosPendentes: Number(orcamentos.rows[0].pendentes),
  };
}

export const getPurchaseInsights = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  if (user.accountType !== "comerciante") throw new Error("Área exclusiva de comerciantes");
  return loadInsights(user.companyId, true);
});

export const getSalesInsights = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  if (user.accountType !== "fornecedor") throw new Error("Área exclusiva de fornecedores");
  return loadInsights(user.companyId, false);
});
