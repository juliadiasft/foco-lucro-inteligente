// Cota de perguntas à IA — o que mostrar quando acaba.
//
// A cota limita a conversa, nunca o valor: oportunidades, alertas de preço e
// de ruptura são calculados todo dia, com ou sem pergunta. A tela precisa dizer
// isso, senão quem esgotou as perguntas acha que o produto parou.
//
// O mês da cota é o mesmo do servidor (`date_trunc('month', now())` em
// ai.server.ts, que roda em UTC): renova no dia 1º às 00:00 UTC.

export type EstadoDaCota = {
  limite: number;
  usadas: number;
  restantes: number;
  esgotada: boolean;
  /** Primeiro instante do mês seguinte. */
  renovaEm: Date;
  diasParaRenovar: number;
};

export function estadoDaCota(usadas: number, limite: number, agora: Date): EstadoDaCota {
  const renovaEm = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
  return {
    limite,
    usadas,
    restantes: Math.max(0, limite - usadas),
    // Limite 0 é "plano sem IA", não "cota esgotada": quem trata é o upgrade.
    esgotada: limite > 0 && usadas >= limite,
    renovaEm,
    diasParaRenovar: Math.max(1, Math.ceil((renovaEm.getTime() - agora.getTime()) / 86_400_000)),
  };
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "1 de outubro" — sem depender do fuso nem do Intl do navegador. */
export function diaPorExtenso(data: Date): string {
  return `${data.getUTCDate()} de ${MESES[data.getUTCMonth()]}`;
}

export const emDias = (n: number) => (n === 1 ? "em 1 dia" : `em ${n} dias`);
