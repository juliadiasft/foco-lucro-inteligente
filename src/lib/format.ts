export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (v: number | null | undefined, digits = 0) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const dataBR = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR");

export const dataHoraBR = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR");
