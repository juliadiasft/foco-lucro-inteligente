// A regra de quando o custo automático pode mexer no custo do produto.
//
// Fica separada do banco de propósito: é a parte em que um erro vira margem
// errada na tela de quem decide preço, então precisa ser testável sem servidor.

export type OrigemDoCusto = "digitado" | "estimado" | "real";

// Acima disso, o custo automático não entra sozinho por cima do digitado:
// vira sugestão. Abaixo, é diferença de arredondamento ou de centavos.
export const DIVERGENCIA_PARA_SUGERIR = 0.05;

export type DecisaoDeCusto = "aplicar" | "sugerir" | "ignorar";

/**
 * Preço da embalagem → custo por unidade base (kg, l ou un). O pedido guarda o
 * preço da embalagem; o produto do comerciante é medido por unidade.
 */
export function custoPorUnidade(precoDaEmbalagem: number, tamanhoDaEmbalagem: number) {
  if (!(precoDaEmbalagem > 0) || !(tamanhoDaEmbalagem > 0)) return null;
  return Math.round((precoDaEmbalagem / tamanhoDaEmbalagem) * 100) / 100;
}

/**
 * O produto só recebe custo automático quando a unidade dele é a do catálogo.
 * Ração vendida em "un" contra tabela em "kg" daria custo por quilo no lugar
 * de custo por saco — errado por um fator de 15, sem nenhum aviso.
 */
export function unidadeCompativel(unidadeDoProduto: string, unidadeBase: string) {
  return unidadeDoProduto.trim().toLowerCase() === unidadeBase.trim().toLowerCase();
}

export function decidirCusto(entrada: {
  atual: number;
  origemAtual: OrigemDoCusto;
  novo: number;
  origemNovo: "estimado" | "real";
}): DecisaoDeCusto {
  const { atual, origemAtual, novo, origemNovo } = entrada;
  if (!(novo > 0)) return "ignorar";
  // Sem custo nenhum, qualquer custo é melhor que nada.
  if (!(atual > 0)) return "aplicar";
  // Tabela é palpite; compra é fato. Palpite nunca rebaixa fato.
  if (origemNovo === "estimado" && origemAtual === "real") return "ignorar";
  if (origemAtual === "digitado") {
    const diferenca = Math.abs(novo - atual) / atual;
    if (diferenca === 0) return origemNovo === "real" ? "aplicar" : "ignorar";
    return diferenca <= DIVERGENCIA_PARA_SUGERIR ? "aplicar" : "sugerir";
  }
  // Custo que já era automático pode ser trocado por outro automático.
  return novo === atual && origemNovo === origemAtual ? "ignorar" : "aplicar";
}

export const rotuloDaOrigem: Record<OrigemDoCusto, string> = {
  digitado: "Custo digitado",
  estimado: "Estimado pela tabela dos fornecedores",
  real: "Preço da última compra na Central",
};

export const seloDaOrigem: Record<OrigemDoCusto, string> = {
  digitado: "digitado",
  estimado: "estimado",
  real: "última compra",
};
