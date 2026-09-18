import { createServerFn } from "@tanstack/react-start";

import {
  acoesParaSubir,
  componentes,
  pontuacao,
  posicaoNaRegiao,
  type SinaisDoFornecedor,
} from "../desempenho-fornecedor";
import { requireActiveSession, type SessionUser } from "../server/auth.server";
import { query } from "../server/db.server";

function requireSupplier(user: SessionUser) {
  if (user.accountType !== "fornecedor") throw new Error("Área exclusiva de fornecedores");
  return user;
}

type LinhaDeSinais = {
  id: string;
  recebidos: string;
  respondidos: string;
  mediana: string | null;
  ofertas: string | null;
  velhas: string | null;
  abertos: string;
};

/**
 * Os sinais de todos os fornecedores publicados da mesma UF (mais o próprio,
 * mesmo despublicado). Mesma UF conta como região, como no painel do primeiro
 * dia: cidade exata seria estreito demais para uma praça que está começando.
 */
async function sinaisDaRegiao(companyId: string) {
  const empresa = await query<{ uf: string | null }>("SELECT uf FROM companies WHERE id=$1", [
    companyId,
  ]);
  const uf = empresa.rows[0]?.uf ?? null;
  const result = await query<LinhaDeSinais>(
    `WITH regiao AS (
       SELECT c.id FROM companies c
         JOIN supplier_profiles sp ON sp.company_id=c.id AND sp.published=true
        WHERE c.account_type='fornecedor' AND ($2::text IS NULL OR c.uf=$2)
       UNION SELECT $1::uuid
     ), pedidos AS (
       SELECT q.supplier_company_id sid, q.created_at,
              (SELECT min(p.created_at) FROM quote_proposals p
                WHERE p.quote_request_id=q.id AND p.from_company_id=q.supplier_company_id) primeira
         FROM quote_requests q
        WHERE q.supplier_company_id IN (SELECT id FROM regiao)
          AND q.created_at >= now() - interval '90 days'
          AND q.status <> 'cancelado'
     ), sinais AS (
       SELECT sid,
              count(*) FILTER (WHERE primeira IS NOT NULL
                                  OR created_at < now() - interval '24 hours') recebidos,
              count(*) FILTER (WHERE primeira IS NOT NULL) respondidos,
              count(*) FILTER (WHERE primeira IS NULL) abertos,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY extract(epoch FROM (primeira - created_at)) / 3600
              ) FILTER (WHERE primeira IS NOT NULL) mediana
         FROM pedidos GROUP BY sid
     ), ofertas AS (
       SELECT company_id sid, count(*) total,
              count(*) FILTER (WHERE updated_at < now() - interval '30 days') velhas
         FROM supplier_offerings
        WHERE active=true AND company_id IN (SELECT id FROM regiao)
        GROUP BY company_id
     )
     SELECT r.id::text id,
            coalesce(s.recebidos,0)::text recebidos, coalesce(s.respondidos,0)::text respondidos,
            s.mediana::text mediana, o.total::text ofertas, o.velhas::text velhas,
            coalesce(s.abertos,0)::text abertos
       FROM regiao r
       LEFT JOIN sinais s ON s.sid=r.id
       LEFT JOIN ofertas o ON o.sid=r.id`,
    [companyId, uf],
  );
  return result.rows.map((l) => ({
    id: l.id,
    abertos: Number(l.abertos),
    sinais: {
      recebidos: Number(l.recebidos),
      respondidos: Number(l.respondidos),
      medianaHoras: l.mediana === null ? null : Number(l.mediana),
      ofertas: Number(l.ofertas ?? 0),
      ofertasVelhas: Number(l.velhas ?? 0),
    } satisfies SinaisDoFornecedor,
  }));
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
