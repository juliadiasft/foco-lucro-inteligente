import type { SinaisDoFornecedor } from "../desempenho-fornecedor";
import { query } from "./db.server";

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
export async function sinaisDaRegiao(companyId: string) {
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
