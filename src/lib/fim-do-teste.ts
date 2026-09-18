// O fim do teste (X05): dizer, antes de bloquear, o que a Central achou.
//
// Hoje o teste só aparece quando vence: a pessoa é barrada e cai em
// /assinatura. Aqui ela é avisada nos últimos dias, com o valor que já saiu do
// sistema — e só o que é verdade: o recuperado (compra e orçamento que
// aconteceram) e o que segue na mesa. Nada estimado por mês.

const DIA = 86_400_000;

/** Dias inteiros até o fim, arredondando para cima. Passou = 0. */
export function diasRestantes(trialEndsAt: string, agora: Date): number {
  const restante = new Date(trialEndsAt).getTime() - agora.getTime();
  return restante <= 0 ? 0 : Math.ceil(restante / DIA);
}

/** Avisa nos últimos três dias, só enquanto o teste ainda vale. */
export function naRetaFinal(status: string, dias: number): boolean {
  return status === "trialing" && dias > 0 && dias <= 3;
}

export function tituloDoFim(dias: number): string {
  return dias === 1 ? "Seu teste acaba amanhã" : `Seu teste acaba em ${dias} dias`;
}

/**
 * "8,5× a mensalidade" — só quando o recuperado de fato cobre a mensalidade.
 * Abaixo de 1×, dizer "0,4× a mensalidade" é argumento contra assinar.
 */
export function vezesAMensalidade(recuperado: number, mensalidade: number): string | null {
  if (mensalidade <= 0 || recuperado < mensalidade) return null;
  const vezes = Math.round((recuperado / mensalidade) * 10) / 10;
  return `${String(vezes).replace(".", ",")}× a mensalidade`;
}
