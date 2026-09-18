// O custo do produto chegando sozinho: do preço pago numa compra e da tabela
// dos fornecedores.
//
// Recebe o cliente de fora, como importar-ofertas.server.ts: quem chama é dono
// da transação, e o teste roda contra um banco de verdade sem subir servidor.
import {
  custoPorUnidade,
  decidirCusto,
  unidadeCompativel,
  type OrigemDoCusto,
} from "../custo-automatico.ts";
import type { DatabaseClient } from "./db.server";

// Mesma normalização que o Painel usava a cada consulta para casar o nome do
// produto com o catálogo. Agora ela só roda para gravar o vínculo.
const CHAVE_DO_NOME = `regexp_replace(lower(translate(p.name,
  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')),
  '[^a-z0-9]+', ' ', 'g')`;

type ProdutoDoCusto = {
  id: string;
  cost_price: string;
  cost_source: OrigemDoCusto;
  cost_suggested: string | null;
  cost_suggested_source: "estimado" | "real" | null;
  cost_dismissed: string | null;
  unit: string;
};

async function aplicarNoProduto(
  client: DatabaseClient,
  produto: ProdutoDoCusto,
  novo: number,
  origemNovo: "estimado" | "real",
) {
  const decisao = decidirCusto({
    atual: Number(produto.cost_price),
    origemAtual: produto.cost_source,
    novo,
    origemNovo,
  });
  if (decisao === "ignorar") return "ignorar" as const;

  if (decisao === "aplicar") {
    await client.query(
      `UPDATE products
          SET cost_price=$2, cost_source=$3, cost_updated_at=now(),
              cost_suggested=NULL, cost_suggested_source=NULL, updated_at=now()
        WHERE id=$1`,
      [produto.id, novo, origemNovo],
    );
    return "aplicar" as const;
  }

  // Sugestão: não repete o que a pessoa já recusou, e tabela não desbanca uma
  // sugestão vinda de compra que ainda espera resposta.
  if (produto.cost_dismissed !== null && Number(produto.cost_dismissed) === novo)
    return "ignorar" as const;
  if (produto.cost_suggested_source === "real" && origemNovo === "estimado")
    return "ignorar" as const;
  await client.query(
    `UPDATE products SET cost_suggested=$2, cost_suggested_source=$3 WHERE id=$1`,
    [produto.id, novo, origemNovo],
  );
  return "sugerir" as const;
}

/**
 * Liga cada produto ativo ao item do catálogo de mesmo nome. Só liga quando há
 * UM item possível: com dois (mesmo nome em kg e em un, por exemplo) fica sem
 * vínculo em vez de chutar — custo do item errado é pior que custo nenhum.
 */
async function vincular(client: DatabaseClient, escopo: Escopo) {
  const filtro = escopo.empresa
    ? "p.company_id=$1"
    : `${CHAVE_DO_NOME} = (SELECT btrim(search_key) FROM catalog_items WHERE id=$1)`;
  await client.query(
    `UPDATE products SET catalog_item_id = m.item
       FROM (
         SELECT p.id, (array_agg(ci.id))[1] item
           FROM products p
           JOIN catalog_items ci ON btrim(ci.search_key) = btrim(${CHAVE_DO_NOME})
          WHERE p.active=true AND p.catalog_item_id IS NULL AND ${filtro}
          GROUP BY p.id
         HAVING count(*) = 1
       ) m
      WHERE products.id = m.id`,
    [escopo.empresa ?? escopo.catalogItemId],
  );
}

export type Escopo =
  { empresa: string; catalogItemId?: never } | { catalogItemId: string; empresa?: never };

/**
 * Recalcula o custo estimado dos produtos vinculados, pela mediana do preço
 * por unidade das tabelas publicadas. Mediana e não o menor preço: o menor é o
 * que o Painel mostra como oportunidade, e usá-lo também como custo faria toda
 * margem parecer maior do que é.
 *
 * Escopo por empresa (o comerciante mexeu nos produtos) ou por item do
 * catálogo (um fornecedor mexeu no preço e todos os compradores mudam).
 */
export async function sincronizarCustoEstimado(client: DatabaseClient, escopo: Escopo) {
  await vincular(client, escopo);

  const filtro = escopo.empresa ? "p.company_id=$1" : "p.catalog_item_id=$1";
  const produtos = await client.query<ProdutoDoCusto & { base_unit: string; mediana: string }>(
    `SELECT p.id, p.cost_price, p.cost_source, p.cost_suggested, p.cost_suggested_source,
            p.cost_dismissed, p.unit, ci.base_unit, t.mediana::text
       FROM products p
       JOIN catalog_items ci ON ci.id = p.catalog_item_id
       JOIN LATERAL (
         SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY o.price / o.pack_size) mediana
           FROM supplier_offerings o
           JOIN supplier_profiles sp ON sp.company_id=o.company_id AND sp.published=true
          WHERE o.catalog_item_id = p.catalog_item_id AND o.active=true
            AND o.price IS NOT NULL AND o.price > 0 AND o.pack_size > 0
       ) t ON t.mediana IS NOT NULL
      WHERE p.active=true AND ${filtro}`,
    [escopo.empresa ?? escopo.catalogItemId],
  );

  let mudou = 0;
  for (const produto of produtos.rows) {
    if (!unidadeCompativel(produto.unit, produto.base_unit)) continue;
    const novo = custoPorUnidade(Number(produto.mediana), 1);
    if (novo === null) continue;
    const resultado = await aplicarNoProduto(client, produto, novo, "estimado");
    if (resultado !== "ignorar") mudou += 1;
  }
  return mudou;
}

/**
 * Pedido concluído: o preço pago vira o custo real dos produtos do comerciante
 * que casam com os itens comprados. É a única fonte que diz "real".
 */
export async function registrarCustoDaCompra(client: DatabaseClient, pedidoId: string) {
  const pedido = await client.query<{ merchant_company_id: string }>(
    "SELECT merchant_company_id FROM purchase_orders WHERE id=$1",
    [pedidoId],
  );
  const empresa = pedido.rows[0]?.merchant_company_id;
  if (!empresa) return 0;
  await vincular(client, { empresa });

  const itens = await client.query<
    ProdutoDoCusto & { base_unit: string; unit_price: string; pack_size: string }
  >(
    `SELECT p.id, p.cost_price, p.cost_source, p.cost_suggested, p.cost_suggested_source,
            p.cost_dismissed, p.unit, i.base_unit, i.unit_price::text, i.pack_size::text
       FROM purchase_order_items i
       JOIN supplier_offerings o ON o.id = i.offering_id
       JOIN products p ON p.catalog_item_id = o.catalog_item_id
      WHERE i.order_id=$1 AND p.company_id=$2 AND p.active=true`,
    [pedidoId, empresa],
  );

  let mudou = 0;
  for (const item of itens.rows) {
    if (!unidadeCompativel(item.unit, item.base_unit)) continue;
    const novo = custoPorUnidade(Number(item.unit_price), Number(item.pack_size));
    if (novo === null) continue;
    const resultado = await aplicarNoProduto(client, item, novo, "real");
    if (resultado !== "ignorar") mudou += 1;
  }
  return mudou;
}

/** Um toque: a pessoa aceita o custo sugerido. */
export async function aceitarCustoSugerido(
  client: DatabaseClient,
  empresa: string,
  produtoId: string,
) {
  const r = await client.query<{ id: string }>(
    `UPDATE products
        SET cost_price=cost_suggested, cost_source=cost_suggested_source,
            cost_updated_at=now(), cost_suggested=NULL, cost_suggested_source=NULL,
            cost_dismissed=NULL, updated_at=now()
      WHERE id=$1 AND company_id=$2 AND cost_suggested IS NOT NULL RETURNING id`,
    [produtoId, empresa],
  );
  return r.rows.length > 0;
}

/** Um toque: a pessoa recusa, e a Central não pergunta o mesmo valor de novo. */
export async function dispensarCustoSugerido(
  client: DatabaseClient,
  empresa: string,
  produtoId: string,
) {
  const r = await client.query<{ id: string }>(
    `UPDATE products
        SET cost_dismissed=cost_suggested, cost_suggested=NULL, cost_suggested_source=NULL
      WHERE id=$1 AND company_id=$2 AND cost_suggested IS NOT NULL RETURNING id`,
    [produtoId, empresa],
  );
  return r.rows.length > 0;
}

/** Um fornecedor mexeu na tabela (ou publicou): recalcula os itens dele. */
export async function sincronizarCustoDoFornecedor(client: DatabaseClient, fornecedor: string) {
  const itens = await client.query<{ catalog_item_id: string }>(
    "SELECT DISTINCT catalog_item_id FROM supplier_offerings WHERE company_id=$1 AND active=true",
    [fornecedor],
  );
  for (const item of itens.rows)
    await sincronizarCustoEstimado(client, { catalogItemId: item.catalog_item_id });
}
