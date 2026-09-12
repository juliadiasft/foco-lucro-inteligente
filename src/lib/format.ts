export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (v: number | null | undefined, digits = 0) =>
  (v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

// Data sem hora — "2026-09-15", como o banco entrega vencimento e data de
// abertura — é um dia do calendário, não um instante. Passá-la por new Date()
// transforma em meia-noite de Londres, e o horário de Brasília, três horas
// atrás, joga para 21h do dia anterior: a conta que vence dia 15 aparecia
// vencendo dia 14. Por isso ela é só remontada, sem virar instante.
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export const dataBR = (d: string | Date) => {
  const soData = typeof d === "string" ? SO_DATA.exec(d) : null;
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  return new Date(d).toLocaleDateString("pt-BR");
};

export const dataHoraBR = (d: string | Date) => new Date(d).toLocaleString("pt-BR");

export const horaBR = (d: string | Date) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Nas conversas, a data completa em cada mensagem vira ruído: quem está
// negociando quer saber se foi hoje, ontem ou "outro dia". Devolve o dia em
// palavras, e a data só quando a palavra não basta.
export const diaBR = (d: string | Date) => {
  const quando = new Date(d);
  const hoje = new Date();
  const dias = Math.round(
    (new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() -
      new Date(quando.getFullYear(), quando.getMonth(), quando.getDate()).getTime()) /
      86400000,
  );
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return quando.toLocaleDateString("pt-BR", { weekday: "long" });
  return quando.toLocaleDateString("pt-BR");
};

// Na lista de conversas o espaço é de uma palavra: hoje mostra a hora, o resto
// mostra o dia.
export const quandoNaLista = (d: string | Date) => {
  const dia = diaBR(d);
  return dia === "Hoje" ? horaBR(d) : dia;
};
