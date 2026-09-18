import { unidadeCompativel, type OrigemDoCusto } from "./custo-automatico.ts";

// A proposta contra o custo de hoje (M09): o comerciante decide melhor vendo
// "R$ 196 abaixo do que eu pago" do que um total solto.
//
// Só entra na conta o item cujo custo a pessoa pode defender: digitado por ela
// ou pago numa compra. Custo estimado pela tabela é palpite da própria Central
// — comparar proposta com palpite seria inventar economia.

export type ItemDaProposta = {
  nome: string;
  precoDaEmbalagem: number;
  tamanhoDaEmbalagem: number;
  quantidade: number;
  unidadeBase: string;
  custoAtual: number | null;
  origemDoCusto: OrigemDoCusto | null;
  unidadeDoProduto: string | null;
};

export type DeltaDaProposta = {
  /** Positivo: a proposta custa menos que o custo de hoje. Negativo: mais. */
  economia: number;
  comparados: number;
  total: number;
};

export function deltaDaProposta(itens: ItemDaProposta[]): DeltaDaProposta | null {
  let soma = 0;
  let comparados = 0;
  for (const item of itens) {
    if (item.custoAtual === null || item.origemDoCusto === null || item.unidadeDoProduto === null)
      continue;
    if (item.origemDoCusto === "estimado") continue;
    if (!(item.custoAtual > 0)) continue;
    if (!unidadeCompativel(item.unidadeDoProduto, item.unidadeBase)) continue;
    if (!(item.precoDaEmbalagem > 0) || !(item.tamanhoDaEmbalagem > 0)) continue;
    if (!(item.quantidade > 0)) continue;
    const propostoPorUnidade = item.precoDaEmbalagem / item.tamanhoDaEmbalagem;
    soma += (item.custoAtual - propostoPorUnidade) * item.tamanhoDaEmbalagem * item.quantidade;
    comparados += 1;
  }
  if (comparados === 0) return null;
  return { economia: Math.round(soma * 100) / 100, comparados, total: itens.length };
}
