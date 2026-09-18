import {
  passaNoFiltro,
  SEM_FILTRO,
  type Alcance,
  type FiltrosDeOrcamento,
  type Lugar,
  type SituacaoDoPedido,
} from "../filtro-orcamentos";
import { query } from "./db.server";

export async function filtrosDoFornecedor(companyId: string): Promise<FiltrosDeOrcamento> {
  const r = await query<{
    valor_minimo: string | null;
    alcance: Alcance;
    segmentos: string[];
    so_com_estoque: boolean;
  }>(
    "SELECT valor_minimo::text, alcance, segmentos, so_com_estoque FROM filtros_de_orcamento WHERE company_id=$1",
    [companyId],
  );
  const l = r.rows[0];
  if (!l) return SEM_FILTRO;
  return {
    valorMinimo: l.valor_minimo === null ? null : Number(l.valor_minimo),
    alcance: l.alcance,
    segmentos: l.segmentos ?? [],
    soComEstoque: l.so_com_estoque,
  };
}

export async function lugarDoFornecedor(companyId: string): Promise<Lugar> {
  const r = await query<{ city: string | null; uf: string | null }>(
    "SELECT city, uf FROM companies WHERE id=$1",
    [companyId],
  );
  return { cidade: r.rows[0]?.city ?? null, uf: r.rows[0]?.uf ?? null };
}

/**
 * Os pedidos dos últimos 90 dias (mais os `ids` pedidos, se fora dessa janela),
 * com o que o filtro precisa saber de cada um.
 */
export async function pedidosParaFiltrar(companyId: string, ids: string[] = []) {
  const r = await query<{
    id: string;
    city: string | null;
    uf: string | null;
    segs: string[] | null;
    valor: string | null;
    todos: boolean;
    respondido: boolean;
  }>(
    `SELECT q.id::text id, m.city, m.uf,
            (SELECT array_agg(cs.segment_id) FROM company_segments cs
              WHERE cs.company_id = q.merchant_company_id) segs,
            (SELECT sum(i.quantity * o.price)::text
               FROM quote_request_items i JOIN supplier_offerings o ON o.id = i.offering_id
              WHERE i.quote_request_id = q.id AND o.price IS NOT NULL) valor,
            NOT EXISTS (SELECT 1 FROM quote_request_items i
                          JOIN supplier_offerings o ON o.id = i.offering_id
                         WHERE i.quote_request_id = q.id AND o.availability <> 'disponivel') todos,
            EXISTS (SELECT 1 FROM quote_proposals p
                     WHERE p.quote_request_id = q.id
                       AND p.from_company_id = q.supplier_company_id) respondido
       FROM quote_requests q
       JOIN companies m ON m.id = q.merchant_company_id
      WHERE q.supplier_company_id = $1 AND q.status <> 'cancelado'
        AND (q.created_at >= now() - interval '90 days' OR q.id = ANY($2::uuid[]))`,
    [companyId, ids],
  );
  return r.rows.map((l) => ({
    id: l.id,
    situacao: {
      valorEstimado: l.valor === null ? null : Number(l.valor),
      comerciante: { cidade: l.city, uf: l.uf, segmentos: l.segs ?? [] },
      todosDisponiveis: l.todos,
      respondido: l.respondido,
    } satisfies SituacaoDoPedido,
  }));
}

/** Quais desses pedidos o filtro salvo do fornecedor esconde. */
export async function pedidosEscondidos(companyId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filtros = await filtrosDoFornecedor(companyId);
  if (JSON.stringify(filtros) === JSON.stringify(SEM_FILTRO)) return new Set();
  const [lugar, pedidos] = await Promise.all([
    lugarDoFornecedor(companyId),
    pedidosParaFiltrar(companyId, ids),
  ]);
  const alvo = new Set(ids);
  return new Set(
    pedidos
      .filter((p) => alvo.has(p.id) && !passaNoFiltro(p.situacao, filtros, lugar))
      .map((p) => p.id),
  );
}
