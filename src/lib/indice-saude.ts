// Índice de saúde do lucro (M01): um número de 0 a 100 para "como está o meu
// lucro", e o que o puxa para baixo.
//
//   índice = 40% margem + 35% custo + 25% giro   (SPEC §5.4)
//
// Cada componente é uma fração de produtos "saudáveis", e não uma média
// suavizada: "3 de 8 produtos pagam mais caro que a região" a pessoa entende e
// sabe consertar; "custo 62,3" não. Componente sem dado (loja sem custo
// cadastrado, sem fornecedor da região para comparar) sai da conta e os pesos
// dos outros são redistribuídos — não punir quem ainda não tem o que medir.

export const PESOS = { margem: 0.4, custo: 0.35, giro: 0.25 } as const;

export type ChaveDoComponente = keyof typeof PESOS;

export type ContagemDoIndice = {
  /** Produtos com custo e preço de venda. */
  comMargem: number;
  /** Desses, quantos com margem abaixo da régua (regras-produto). */
  margemBaixa: number;
  /** Produtos que a Central conseguiu comparar com a tabela dos fornecedores. */
  comparados: number;
  /** Desses, quantos pagam claramente mais caro que o melhor da região. */
  pagandoCaro: number;
  /** Produtos ativos, com mais de 90 dias de cadastro. */
  ativos: number;
  /** Desses, quantos não vendem há mais de 90 dias. */
  parados: number;
};

export type ComponenteDoIndice = {
  chave: ChaveDoComponente;
  titulo: string;
  /** 0 a 1. */
  valor: number;
  /** "3 de 8 produtos com margem abaixo de 20%" */
  detalhe: string;
  /** Quantos produtos puxam para baixo. */
  problemas: number;
};

const frac = (bons: number, total: number) => (total > 0 ? bons / total : null);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function componentesDoIndice(c: ContagemDoIndice): ComponenteDoIndice[] {
  const lista: ComponenteDoIndice[] = [];
  const margem = frac(c.comMargem - c.margemBaixa, c.comMargem);
  if (margem !== null)
    lista.push({
      chave: "margem",
      titulo: "Margem",
      valor: margem,
      problemas: c.margemBaixa,
      detalhe: `${c.margemBaixa} de ${plural(c.comMargem, "produto", "produtos")} com margem baixa`,
    });
  const custo = frac(c.comparados - c.pagandoCaro, c.comparados);
  if (custo !== null)
    lista.push({
      chave: "custo",
      titulo: "Custo de compra",
      valor: custo,
      problemas: c.pagandoCaro,
      detalhe: `${c.pagandoCaro} de ${plural(c.comparados, "produto", "produtos")} com fornecedor mais barato na região`,
    });
  const giro = frac(c.ativos - c.parados, c.ativos);
  if (giro !== null)
    lista.push({
      chave: "giro",
      titulo: "Giro",
      valor: giro,
      problemas: c.parados,
      detalhe: `${c.parados} de ${plural(c.ativos, "produto", "produtos")} sem vender há mais de 90 dias`,
    });
  return lista;
}

/** 0 a 100, inteiro. Nulo quando não há nada a medir. */
export function indiceDeSaude(componentes: ComponenteDoIndice[]): number | null {
  let soma = 0;
  let pesos = 0;
  for (const c of componentes) {
    soma += c.valor * PESOS[c.chave];
    pesos += PESOS[c.chave];
  }
  return pesos === 0 ? null : Math.round((soma / pesos) * 100);
}

/**
 * Os pontos que mais puxam o índice para baixo: quanto cada componente ainda
 * tem a ganhar, já pesado. Só os que têm problema, do maior ganho ao menor.
 */
export function pontosQuePuxamParaBaixo(componentes: ComponenteDoIndice[]) {
  const pesoTotal = componentes.reduce((s, c) => s + PESOS[c.chave], 0);
  return componentes
    .filter((c) => c.problemas > 0)
    .map((c) => ({ ...c, perda: Math.round(((1 - c.valor) * PESOS[c.chave] * 100) / pesoTotal) }))
    .sort((a, b) => b.perda - a.perda);
}

export type Faixa = "boa" | "atencao" | "ruim";

export function faixaDoIndice(indice: number): Faixa {
  return indice >= 75 ? "boa" : indice >= 50 ? "atencao" : "ruim";
}

export type FotoDoIndice = { data: string; score: number };

const DIA = 86_400_000;

/**
 * "+6 no mês": compara com a foto mais antiga que tenha entre 7 e 35 dias.
 * Menos de uma semana não diz nada; sem foto antiga o suficiente, sem variação
 * (o índice começa a ser guardado quando a pessoa abre o Painel).
 */
export function variacaoDoIndice(
  hoje: { data: string; score: number },
  fotos: FotoDoIndice[],
): { pontos: number; dias: number } | null {
  const agora = new Date(`${hoje.data}T00:00:00Z`).getTime();
  const candidatas = fotos
    .map((f) => ({
      ...f,
      idade: Math.round((agora - new Date(`${f.data}T00:00:00Z`).getTime()) / DIA),
    }))
    .filter((f) => f.idade >= 7 && f.idade <= 35)
    .sort((a, b) => b.idade - a.idade);
  const base = candidatas[0];
  return base ? { pontos: hoje.score - base.score, dias: base.idade } : null;
}
