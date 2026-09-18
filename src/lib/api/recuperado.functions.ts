import { createServerFn } from "@tanstack/react-start";

import { ordenarExtrato, totalDoExtrato, totalDoMes, type ItemDoExtrato } from "../recuperado";
import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

const reais = (valor: string) => Number(valor).toFixed(2).replace(".", ",");

// O extrato do "já recuperado" (A03). Duas fontes, as mesmas do Painel:
// compra concluída mais barata que o custo anterior (economias_recuperadas) e
// orçamento fechado abaixo da primeira proposta. Nada estimado entra aqui.
export const getRecuperado = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();

  const [compras, negociacoes] = await Promise.all([
    query<{
      id: string;
      valor: string;
      criado_em: Date;
      custo_anterior: string;
      custo_pago: string;
      produto: string | null;
      fornecedor: string | null;
    }>(
      `SELECT e.id, e.valor::text, e.criado_em, e.custo_anterior::text, e.custo_pago::text,
              p.name produto, coalesce(sp.display_name, c.name) fornecedor
         FROM economias_recuperadas e
         LEFT JOIN products p ON p.id=e.product_id
         JOIN purchase_orders o ON o.id=e.order_id
         LEFT JOIN companies c ON c.id=o.supplier_company_id
         LEFT JOIN supplier_profiles sp ON sp.company_id=o.supplier_company_id
        WHERE e.company_id=$1
        ORDER BY e.criado_em DESC LIMIT 200`,
      [user.companyId],
    ),
    query<{ id: string; valor: string; criado_em: Date; fornecedor: string | null }>(
      `WITH primeira AS (
         SELECT DISTINCT ON (quote_request_id) quote_request_id, total
           FROM quote_proposals ORDER BY quote_request_id, created_at
       ), aceita AS (
         SELECT quote_request_id, total, created_at FROM quote_proposals WHERE status='aceita'
       )
       SELECT q.id, (p.total - a.total)::text valor, a.created_at criado_em,
              coalesce(sp.display_name, c.name) fornecedor
         FROM aceita a
         JOIN primeira p ON p.quote_request_id=a.quote_request_id
         JOIN quote_requests q ON q.id=a.quote_request_id
         LEFT JOIN companies c ON c.id=q.supplier_company_id
         LEFT JOIN supplier_profiles sp ON sp.company_id=q.supplier_company_id
        WHERE q.merchant_company_id=$1 AND p.total > a.total
        ORDER BY a.created_at DESC LIMIT 200`,
      [user.companyId],
    ),
  ]);

  const itens: ItemDoExtrato[] = [
    ...compras.rows.map((linha) => ({
      id: `compra:${linha.id}`,
      tipo: "compra" as const,
      titulo: linha.produto ?? "Produto removido",
      detalhe: `custo R$ ${reais(linha.custo_anterior)} → R$ ${reais(linha.custo_pago)} por unidade${linha.fornecedor ? ` · ${linha.fornecedor}` : ""}`,
      valor: Number(linha.valor),
      em: linha.criado_em.toISOString(),
    })),
    ...negociacoes.rows.map((linha) => ({
      id: `negociacao:${linha.id}`,
      tipo: "negociacao" as const,
      titulo: `Orçamento fechado${linha.fornecedor ? ` com ${linha.fornecedor}` : ""}`,
      detalhe: "fechou abaixo da primeira proposta",
      valor: Number(linha.valor),
      em: linha.criado_em.toISOString(),
    })),
  ];

  // O que ainda está na mesa: achado que a pessoa não aproveitou. Fica separado
  // do recuperado, e pesa só a primeira compra — não é projeção mensal.
  let naMesa = { total: 0, quantos: 0 };
  try {
    const { acharSinaisDeEconomia } = await import("../server/signals.server");
    const sinais = await acharSinaisDeEconomia(user.companyId);
    naMesa = {
      total: Math.round(sinais.reduce((soma, s) => soma + s.economiaNaCompra, 0) * 100) / 100,
      quantos: sinais.length,
    };
  } catch (erro) {
    console.error("Falha ao somar o que está na mesa", erro);
  }

  const ordenados = ordenarExtrato(itens);
  return {
    itens: ordenados,
    total: totalDoExtrato(ordenados),
    mes: totalDoMes(ordenados),
    naMesa,
  };
});
