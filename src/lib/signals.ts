// A extensão .ts no import é proposital, e é o único lugar do projeto que faz
// isso: é o que permite o scripts/signals.test.mjs importar este arquivo
// direto pelo Node, sem passo de build. Sem ela o teste caía no fallback e
// passava sem testar nada. O tsconfig já tem allowImportingTsExtensions.
import { effectivePrice, normalizeBaseUnit, type BaseUnit } from "./catalog.ts";

// A decisão dos sinais de economia, separada do banco de propósito.
//
// Tudo o que pode errar de forma cara mora aqui: comparar unidades
// incompatíveis, escolher a oferta errada, avisar por centavos. Deixando puro,
// o teste exercita este código, e não uma cópia dele escrita à mão no teste —
// que é o jeito de um teste passar enquanto a produção erra.

// Piso para virar aviso. Existe para não gastar a atenção do comerciante — e o
// push do celular dele — com centavos. Quem recebe aviso de economia de R$ 0,40
// desliga a notificação, e aí perde também os avisos que valiam.
export const ECONOMIA_MINIMA_PERCENTUAL = 10;
export const ECONOMIA_MINIMA_REAIS_NA_COMPRA = 20;

export type OfertaComparavel = {
  fornecedorId: string;
  fornecedor: string;
  baseUnit: BaseUnit;
  packSize: number;
  price: number | null;
  promoPrice: number | null;
  promoUntil: string | null;
  minimumQuantity: number;
};

export type SinalDeEconomia = {
  produtoId: string;
  produto: string;
  fornecedorId: string;
  fornecedor: string;
  precoAtual: number;
  precoFornecedor: number;
  economiaPorUnidade: number;
  economiaNaCompra: number;
  percentual: number;
};

/** Preço por unidade base de uma oferta, já considerando promoção no prazo. */
export function precoPorUnidadeBase(oferta: OfertaComparavel) {
  const vigente = effectivePrice(oferta.price, oferta.promoPrice, oferta.promoUntil);
  if (vigente === null || !(oferta.packSize > 0)) return null;
  return vigente / oferta.packSize;
}

/**
 * Avalia se as ofertas do marketplace batem o custo que o comerciante já paga.
 * Devolve null quando não há sinal — que é o caso mais comum e o mais
 * importante de acertar.
 */
export function avaliarSinal(
  produto: { id: string; nome: string; unidade: string | null; custo: number },
  ofertas: OfertaComparavel[],
): SinalDeEconomia | null {
  // Sem unidade reconhecida não dá para comparar: reais por quilo contra reais
  // por unidade dá um número errado, e número errado sobre dinheiro é pior que
  // número nenhum.
  const unidade = normalizeBaseUnit(produto.unidade);
  if (!unidade) return null;
  if (!(produto.custo > 0)) return null;

  let melhor: { oferta: OfertaComparavel; porUnidade: number } | null = null;
  for (const oferta of ofertas) {
    // A embalagem do fornecedor tem que estar na mesma unidade do produto do
    // comerciante. Ração vendida por quilo não se compara com sabonete por
    // unidade, mesmo que o nome case.
    if (oferta.baseUnit !== unidade) continue;
    const porUnidade = precoPorUnidadeBase(oferta);
    if (porUnidade === null) continue;
    if (!melhor || porUnidade < melhor.porUnidade) melhor = { oferta, porUnidade };
  }
  if (!melhor) return null;

  const economiaPorUnidade = produto.custo - melhor.porUnidade;
  if (economiaPorUnidade <= 0) return null;

  const percentual = (economiaPorUnidade / produto.custo) * 100;
  if (percentual < ECONOMIA_MINIMA_PERCENTUAL) return null;

  // O tamanho da compra é o mínimo que o fornecedor aceita: é o dinheiro que o
  // comerciante economiza de verdade na primeira compra, não uma projeção.
  const quantidadeMinima = Math.max(1, melhor.oferta.minimumQuantity);
  const economiaNaCompra = economiaPorUnidade * melhor.oferta.packSize * quantidadeMinima;
  if (economiaNaCompra < ECONOMIA_MINIMA_REAIS_NA_COMPRA) return null;

  return {
    produtoId: produto.id,
    produto: produto.nome,
    fornecedorId: melhor.oferta.fornecedorId,
    fornecedor: melhor.oferta.fornecedor,
    precoAtual: produto.custo,
    precoFornecedor: melhor.porUnidade,
    economiaPorUnidade,
    economiaNaCompra,
    percentual,
  };
}

// Teto por rodada. Trinta avisos de uma vez não é ajuda, é enxurrada. Os
// maiores primeiro: se houver mais achados que o teto, os que ficam de fora são
// os que valem menos dinheiro.
export const MAXIMO_POR_RODADA = 5;

export function priorizar(sinais: SinalDeEconomia[]) {
  return [...sinais]
    .sort((a, b) => b.economiaNaCompra - a.economiaNaCompra)
    .slice(0, MAXIMO_POR_RODADA);
}
