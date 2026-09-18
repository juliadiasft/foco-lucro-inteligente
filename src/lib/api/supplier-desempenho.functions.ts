import { createServerFn } from "@tanstack/react-start";

import { acoesParaSubir, componentes, pontuacao, posicaoNaRegiao } from "../desempenho-fornecedor";
import { sinaisDaRegiao } from "../server/desempenho.server";
import { requireActiveSession, type SessionUser } from "../server/auth.server";
import { query } from "../server/db.server";

function requireSupplier(user: SessionUser) {
  if (user.accountType !== "fornecedor") throw new Error("Área exclusiva de fornecedores");
  return user;
}

// S07: onde o fornecedor está na região, o que pesa e o que sobe mais rápido.
export const getPosicaoNaBusca = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  const regiao = await sinaisDaRegiao(user.companyId);
  const eu = regiao.find((r) => r.id === user.companyId);
  if (!eu) return null;
  const minha = pontuacao(eu.sinais);
  const posicao = posicaoNaRegiao(
    minha,
    regiao.map((r) => pontuacao(r.sinais)),
  );
  const uf = await query<{ city: string | null; uf: string | null }>(
    "SELECT city, uf FROM companies WHERE id=$1",
    [user.companyId],
  );
  return {
    regiao: uf.rows[0]?.city
      ? `${uf.rows[0].city}/${uf.rows[0].uf ?? ""}`
      : (uf.rows[0]?.uf ?? null),
    posicao,
    pontuacao: minha === null ? null : Math.round(minha),
    componentes: componentes(eu.sinais),
    sinais: eu.sinais,
    abertos: eu.abertos,
    acoes: acoesParaSubir(eu.sinais, eu.abertos),
  };
});

// S09: o que a Central vendeu, converteu e o que pediram e o fornecedor não tinha.
export const getRelatorioDoFornecedor = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  const [vendas, orcamentos, recompra, uf] = await Promise.all([
    query<{ mes: string; total: string; pedidos: string }>(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') mes,
              sum(total)::text total, count(*)::text pedidos
         FROM purchase_orders
        WHERE supplier_company_id=$1 AND status IN ('aceito','concluido')
          AND created_at >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1 ORDER BY 1`,
      [user.companyId],
    ),
    query<{ total: string; aceitos: string }>(
      `SELECT count(*)::text total, count(*) FILTER (WHERE status='aceito')::text aceitos
         FROM quote_requests
        WHERE supplier_company_id=$1 AND status <> 'cancelado'
          AND created_at >= now() - interval '90 days'`,
      [user.companyId],
    ),
    query<{ clientes: string; recorrentes: string }>(
      `SELECT count(*)::text clientes, count(*) FILTER (WHERE n >= 2)::text recorrentes FROM (
         SELECT merchant_company_id, count(*) n FROM purchase_orders
          WHERE supplier_company_id=$1 AND status IN ('aceito','concluido')
          GROUP BY 1) t`,
      [user.companyId],
    ),
    query<{ uf: string | null }>("SELECT uf FROM companies WHERE id=$1", [user.companyId]),
  ]);

  // Buscas dos últimos 30 dias na região que nada do catálogo do fornecedor
  // atende. É o mesmo dado do painel do primeiro dia, agora para quem já tem
  // catálogo: o que falta nele.
  const semItem = await query<{ termo: string; buscas: string; comerciantes: string }>(
    `SELECT b.termo, count(*)::text buscas, count(DISTINCT b.company_id)::text comerciantes
       FROM buscas_do_comerciante b
      WHERE b.criado_em >= now() - interval '30 days' AND b.termo <> ''
        AND ($2::text IS NULL OR b.uf = $2)
        AND NOT EXISTS (
          SELECT 1 FROM supplier_offerings o
            JOIN catalog_items ci ON ci.id = o.catalog_item_id
           WHERE o.company_id=$1 AND o.active=true AND ci.search_key LIKE '%' || b.termo || '%')
      GROUP BY b.termo
      ORDER BY count(DISTINCT b.company_id) DESC, count(*) DESC
      LIMIT 5`,
    [user.companyId, uf.rows[0]?.uf ?? null],
  );

  return {
    vendas: vendas.rows.map((v) => ({
      mes: v.mes,
      total: Number(v.total),
      pedidos: Number(v.pedidos),
    })),
    orcamentos: {
      total: Number(orcamentos.rows[0]?.total ?? 0),
      aceitos: Number(orcamentos.rows[0]?.aceitos ?? 0),
    },
    recompra: {
      clientes: Number(recompra.rows[0]?.clientes ?? 0),
      recorrentes: Number(recompra.rows[0]?.recorrentes ?? 0),
    },
    pediramENaoTinha: semItem.rows.map((r) => ({
      termo: r.termo,
      buscas: Number(r.buscas),
      comerciantes: Number(r.comerciantes),
    })),
  };
});
