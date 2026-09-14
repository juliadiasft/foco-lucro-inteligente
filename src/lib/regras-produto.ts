// O que conta como margem baixa e estoque baixo — um lugar só.
//
// Até 14/09/2026 cada tela tinha a sua régua. O Painel chamava de "margem muito
// baixa" o que sobrava menos de 20%; a tela de Produtos pintava de vermelho só
// abaixo de 15%, e de amarelo até 30%. A ração com 16% de margem era alerta num
// lugar e "quase ok" no outro — e quem tocava no aviso do Painel caía numa
// lista em que nada estava marcado. Com estoque era igual: o Painel usava 5
// como mínimo quando o produto não tinha um, Produtos não marcava nada.

export const MARGEM_BAIXA_PERCENTUAL = 20;

// Quem não configurou estoque mínimo ainda quer saber quando está acabando.
export const ESTOQUE_MINIMO_PADRAO = 5;

/** Quanto sobra de cada venda, em % do preço. Sem preço, não há margem. */
export const margemPercentual = (custo: number, venda: number) =>
  venda > 0 ? ((venda - custo) / venda) * 100 : null;

export const margemBaixa = (custo: number, venda: number) => {
  const margem = margemPercentual(custo, venda);
  return margem !== null && margem < MARGEM_BAIXA_PERCENTUAL;
};

export const estoqueBaixo = (estoque: number, minimo: number) =>
  estoque <= (minimo || ESTOQUE_MINIMO_PADRAO);
