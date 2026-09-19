import { createHash } from "node:crypto";

import { catalogSearchKey, normalizeBaseUnit, type BaseUnit } from "../catalog";
import { brl } from "../format";
import { avaliarSinal, precoPorUnidadeBase, priorizar, type OfertaComparavel } from "../signals";
import { query } from "./db.server";
import { sendCompanyPush } from "./push.server";

// Sinais de economia: o sistema avisa quando um fornecedor da Central vende,
// mais barato, algo que o comerciante já compra.
//
// Por que isto existe: até aqui o alerta de oportunidade só nascia no instante
// em que o próprio comerciante digitava um preço na mão, e comparava só os
// preços que ele mesmo tinha cadastrado. O catálogo dos fornecedores
// publicados — que é o coração do marketplace — nunca gerava aviso nenhum. Um
// fornecedor podia baixar o preço pela metade e ninguém ficava sabendo.
//
// Também importa para quem já assinou: quem entra, não usa e não vê valor é
// quem cancela no primeiro boleto. Um aviso com dinheiro concreto dentro traz
// a pessoa de volta sem precisar de ligação.
//
// A decisão de o que vira aviso mora em ../signals.ts, puro e testado. Aqui só
// se busca no banco, grava e dispara o push.

type ProdutoDoComerciante = {
  id: string;
  nome: string;
  unidade: string;
  custo: string;
};

type OfertaCandidata = {
  fornecedor_id: string;
  fornecedor: string;
  pack_size: string;
  price: string | null;
  promo_price: string | null;
  promo_until: Date | null;
  minimum_quantity: string;
  base_unit: BaseUnit;
};

/**
 * Todo achado de economia de uma empresa: oferta do marketplace mais barata que
 * o custo que ela já paga. Só lê — quem grava aviso é gerarSinaisDeEconomia, e
 * a tela do extrato usa isto para mostrar o que ainda está na mesa.
 */
export async function acharSinaisDeEconomia(companyId: string) {
  return (await compararCustos(companyId)).sinais;
}

/**
 * A mesma varredura, dizendo também em quantos produtos houve com o que
 * comparar: o índice de saúde precisa do denominador ("3 de 8 pagam mais
 * caro"), e um produto sem oferta da região não conta nem a favor nem contra.
 */
export async function compararCustos(companyId: string) {
  const produtos = await query<ProdutoDoComerciante>(
    `SELECT id, name nome, unit unidade, cost_price custo
       FROM products
      WHERE company_id=$1 AND active=true AND cost_price > 0`,
    [companyId],
  );

  const encontrados = [];
  let comparados = 0;

  for (const produto of produtos.rows) {
    // A busca já filtra pela unidade, mas quem decide continua sendo o
    // avaliarSinal: se a unidade não for reconhecida, nem consulta o banco.
    const unidade = normalizeBaseUnit(produto.unidade);
    if (!unidade) continue;

    const ofertas = await query<OfertaCandidata>(
      `SELECT c.id fornecedor_id,
              coalesce(sp.display_name, c.name) fornecedor,
              o.pack_size, o.price, o.promo_price, o.promo_until,
              o.minimum_quantity, ci.base_unit
         FROM supplier_offerings o
         JOIN catalog_items ci ON ci.id=o.catalog_item_id
         JOIN supplier_profiles sp ON sp.company_id=o.company_id AND sp.published=true
         JOIN companies c ON c.id=sp.company_id AND c.account_type='fornecedor'
        WHERE o.active=true
          AND o.availability <> 'esgotado'
          AND ci.search_key = $1
          AND ci.base_unit = $2
          AND o.company_id <> $3`,
      [catalogSearchKey(produto.nome), unidade, companyId],
    );

    const comparaveis: OfertaComparavel[] = ofertas.rows.map((linha) => ({
      fornecedorId: linha.fornecedor_id,
      fornecedor: linha.fornecedor,
      baseUnit: linha.base_unit,
      packSize: Number(linha.pack_size),
      price: linha.price === null ? null : Number(linha.price),
      promoPrice: linha.promo_price === null ? null : Number(linha.promo_price),
      promoUntil: linha.promo_until ? linha.promo_until.toISOString().slice(0, 10) : null,
      minimumQuantity: Number(linha.minimum_quantity),
    }));

    if (comparaveis.some((o) => precoPorUnidadeBase(o) !== null)) comparados++;
    const sinal = avaliarSinal(
      {
        id: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        custo: Number(produto.custo),
      },
      comparaveis,
    );
    if (sinal) encontrados.push(sinal);
  }
  return { sinais: encontrados, comparados };
}

/**
 * Procura, para uma empresa, ofertas do marketplace mais baratas do que o custo
 * que ela já paga. Grava notificação e dispara push para cada uma.
 *
 * Idempotente: a chave de deduplicação inclui o preço, então o mesmo achado não
 * volta a avisar, mas uma queda nova de preço avisa de novo.
 */
export async function gerarSinaisDeEconomia(companyId: string) {
  const encontrados = await acharSinaisDeEconomia(companyId);
  const criados = [];
  for (const sinal of priorizar(encontrados)) {
    // O preço entra na chave: o mesmo achado não avisa duas vezes, mas uma
    // queda nova avisa de novo.
    const assinatura = `${sinal.produtoId}:${sinal.fornecedorId}:${sinal.precoFornecedor.toFixed(4)}`;
    const dedupeKey = `sinal:${createHash("sha256").update(assinatura).digest("hex")}`;
    const titulo = `${sinal.fornecedor} está mais barato`;
    const mensagem =
      `${sinal.produto}: você paga ${brl(sinal.precoAtual)} e lá está ${brl(sinal.precoFornecedor)}. ` +
      `São ${brl(sinal.economiaNaCompra)} de economia já na primeira compra.`;

    const inserido = await query<{ id: string }>(
      `INSERT INTO notifications (company_id,type,title,message,action_url,payload,dedupe_key,expires_at)
       VALUES ($1,'supplier_opportunity',$2,$3,'/fornecedores',$4::jsonb,$5,now()+interval '30 days')
       ON CONFLICT (company_id,dedupe_key) DO NOTHING RETURNING id`,
      [companyId, titulo, mensagem, JSON.stringify(sinal), dedupeKey],
    );
    if (!inserido.rows[0]) continue;

    criados.push(sinal);
    void sendCompanyPush(companyId, {
      title: titulo,
      body: mensagem,
      url: "/fornecedores",
      tag: dedupeKey,
    }).catch((erro) => {
      // Push é o canal, não o aviso. Se falhar, a notificação já está gravada e
      // aparece na tela do mesmo jeito.
      console.error("Falha ao enviar push do sinal de economia", erro);
    });
  }

  return criados;
}

/**
 * Um fornecedor mexeu na tabela: avisa, agora, cada comerciante que compra
 * algum item dele. Sem isto o aviso só nascia na próxima vez que o comerciante
 * abrisse o sino — um preço que caiu de manhã só era notado no dia seguinte.
 *
 * Reaproveita gerarSinaisDeEconomia, com o mesmo piso de economia, o teto por
 * rodada e a chave que inclui o preço. Falha numa empresa não impede as outras.
 */
export async function gerarSinaisParaFornecedor(fornecedor: string) {
  const empresas = await query<{ company_id: string }>(
    `SELECT DISTINCT p.company_id
       FROM products p
       JOIN companies c ON c.id=p.company_id AND c.account_type='comerciante'
      WHERE p.active=true AND p.cost_price > 0
        AND p.catalog_item_id IN (
          SELECT catalog_item_id FROM supplier_offerings WHERE company_id=$1 AND active=true
        )`,
    [fornecedor],
  );
  for (const { company_id } of empresas.rows) {
    try {
      await gerarSinaisDeEconomia(company_id);
    } catch (erro) {
      console.error("Falha ao gerar sinais de economia", erro);
    }
  }
}
