// O extrato do "já recuperado" (A03), separado do banco.
//
// O número que vale é o que já aconteceu: compra concluída mais barata que o
// custo anterior, e orçamento fechado abaixo da primeira proposta. O que ainda
// é só achado (um fornecedor mais barato que a pessoa nem testou) aparece
// separado, como "na mesa" — nunca somado ao recuperado.

export type ItemDoExtrato = {
  id: string;
  tipo: "compra" | "negociacao";
  titulo: string;
  detalhe: string;
  valor: number;
  em: string;
};

export type FiltroDoExtrato = "todas" | "compra" | "negociacao";

export function totalDoExtrato(itens: ItemDoExtrato[]) {
  return Math.round(itens.reduce((soma, item) => soma + item.valor, 0) * 100) / 100;
}

/** Do mais recente ao mais antigo; empate pelo maior valor. */
export function ordenarExtrato(itens: ItemDoExtrato[]) {
  return [...itens].sort((a, b) => b.em.localeCompare(a.em) || b.valor - a.valor);
}

export function filtrarExtrato(itens: ItemDoExtrato[], filtro: FiltroDoExtrato) {
  return filtro === "todas" ? itens : itens.filter((item) => item.tipo === filtro);
}

/** Quanto do total caiu no mês corrente (mês e ano da data de referência). */
export function totalDoMes(itens: ItemDoExtrato[], agora: Date = new Date()) {
  const doMes = itens.filter((item) => {
    const data = new Date(item.em);
    return data.getFullYear() === agora.getFullYear() && data.getMonth() === agora.getMonth();
  });
  return totalDoExtrato(doMes);
}
