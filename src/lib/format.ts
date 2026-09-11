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
