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

/** Como o Painel fala do custo, para não afirmar que "você paga" o que é só estimativa. */
export const frasePagaPorOrigem: Record<OrigemDoCusto, string> = {
  digitado: "Você paga",
  estimado: "Seu custo estimado é",
  real: "Na última compra você pagou",
};

/** Aviso curto para margem calculada em cima de um custo que ainda não é real. */
export function avisoDeCustoEstimado(origem: OrigemDoCusto) {
  return origem === "estimado"
    ? " Custo estimado pela tabela dos fornecedores — confirme o seu."
    : "";
}

/**
 * Quanto a compra economizou em relação ao custo que o comerciante tinha.
 * Só conta contra custo digitado ou de compra anterior: estimativa é palpite
 * da própria Central, e economia sobre palpite seria dinheiro inventado.
 */
export function economiaDaCompra(entrada: {
  custoAnterior: number;
  origemAnterior: OrigemDoCusto;
  custoPago: number;
  quantidadeBase: number;
}) {
  const { custoAnterior, origemAnterior, custoPago, quantidadeBase } = entrada;
  if (origemAnterior === "estimado") return null;
  if (!(custoAnterior > 0) || !(custoPago > 0) || !(quantidadeBase > 0)) return null;
  if (!(custoPago < custoAnterior)) return null;
  const valor = Math.round((custoAnterior - custoPago) * quantidadeBase * 100) / 100;
  return valor > 0 ? valor : null;
}

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "para", "com", "e", "a", "o"]);

export function palavrasDoNome(nome: string) {
  return new Set(
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((palavra) => palavra.length > 0 && !PALAVRAS_VAZIAS.has(palavra)),
  );
}

/**
 * 0 a 1: o quanto o nome do produto parece o do item do catálogo. Regras que
 * protegem dinheiro: número diferente (15kg x 10kg) zera, porque é outro
 * produto; e uma palavra só ("ração") nunca basta.
 */
export function parecencaDeNomes(nomeDoProduto: string, nomeDoCatalogo: string) {
  const a = palavrasDoNome(nomeDoProduto);
  const b = palavrasDoNome(nomeDoCatalogo);
  const comNumero = (palavras: Set<string>) => [...palavras].filter((p) => /\d/.test(p)).sort();
  const numerosA = comNumero(a);
  const numerosB = comNumero(b);
  if (numerosA.length && numerosB.length && numerosA.join() !== numerosB.join()) return 0;

  const comuns = [...a].filter((palavra) => b.has(palavra)).length;
  const menor = Math.min(a.size, b.size);
  if (comuns < 2 || menor < 2) return 0;
  const uniao = a.size + b.size - comuns;
  return Math.max(comuns / menor === 1 ? 0.8 : 0, comuns / uniao);
}

export const PARECENCIA_MINIMA = 0.6;
