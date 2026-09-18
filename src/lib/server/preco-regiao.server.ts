// O aviso "seu preço está acima da região" para o fornecedor.
//
// Compara a tabela dele com a mediana das tabelas publicadas dos demais na
// mesma UF, por preço na unidade base. É a tabela, não venda fechada — o texto
// da tela diz isso. Recebe o executor de consultas de fora para ser testável
// contra um banco de verdade.
import { MIN_CONCORRENTES, precoAcimaDaRegiao } from "../preco-regiao.ts";
import type { DatabaseClient } from "./db.server";

export async function precosAcimaDaRegiao(db: DatabaseClient, empresa: string) {
  const dados = await db.query<{ uf: string | null }>("SELECT uf FROM companies WHERE id=$1", [
    empresa,
  ]);
  const uf = dados.rows[0]?.uf ?? null;

  const linhas = await db.query<{
    item: string;
    unidade: string;
    meu: string;
    mediana: string;
    concorrentes: string;
  }>(
    `WITH minhas AS (
       SELECT o.catalog_item_id, min(o.price / o.pack_size) preco
         FROM supplier_offerings o
        WHERE o.company_id=$1 AND o.active=true AND o.price > 0 AND o.pack_size > 0
        GROUP BY o.catalog_item_id
     ), outros AS (
       SELECT o.catalog_item_id,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY o.price / o.pack_size) mediana,
              count(DISTINCT o.company_id) concorrentes
         FROM supplier_offerings o
         JOIN supplier_profiles sp ON sp.company_id=o.company_id AND sp.published=true
         JOIN companies c ON c.id=o.company_id
        WHERE o.company_id <> $1 AND o.active=true AND o.price > 0 AND o.pack_size > 0
          AND ($2::text IS NULL OR c.uf = $2)
        GROUP BY o.catalog_item_id
     )
     SELECT ci.name item, ci.base_unit unidade, minhas.preco::text meu,
            outros.mediana::text mediana, outros.concorrentes::text concorrentes
       FROM minhas
       JOIN outros ON outros.catalog_item_id = minhas.catalog_item_id
       JOIN catalog_items ci ON ci.id = minhas.catalog_item_id
      WHERE outros.concorrentes >= $3
      ORDER BY (minhas.preco - outros.mediana) / outros.mediana DESC
      LIMIT 50`,
    [empresa, uf, MIN_CONCORRENTES],
  );

  const itens = linhas.rows
    .map((linha) => {
      const meuPreco = Number(linha.meu);
      const medianaDosOutros = Number(linha.mediana);
      const concorrentes = Number(linha.concorrentes);
      const acima = precoAcimaDaRegiao({ meuPreco, medianaDosOutros, concorrentes });
      if (!acima) return null;
      return {
        item: linha.item,
        unidade: linha.unidade,
        meuPreco,
        medianaDosOutros,
        concorrentes,
        diferenca: acima.diferenca,
        percentual: acima.percentual,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 5);

  return { regiao: uf, itens };
}
