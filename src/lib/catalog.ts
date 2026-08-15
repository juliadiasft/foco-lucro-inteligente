export type BaseUnit = "kg" | "l" | "un";

export const baseUnitLabels: Record<BaseUnit, string> = {
  kg: "Quilo (kg)",
  l: "Litro (L)",
  un: "Unidade",
};

export const baseUnitShort: Record<BaseUnit, string> = {
  kg: "kg",
  l: "L",
  un: "un",
};

export const baseUnits: BaseUnit[] = ["kg", "l", "un"];

// Reduz grafias diferentes do mesmo produto a uma chave só: sem acento, sem
// pontuação, em minúsculas e com espaços colapsados. É o que faz "Ração
// Golden" e "racao golden" caírem no mesmo item do catálogo.
export function catalogSearchKey(name: string, brand?: string | null) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return [normalize(brand || ""), normalize(name)].filter(Boolean).join(" ");
}

// Traduz a unidade escrita à mão pelo comerciante ("kg", "quilo", "un", "pç")
// para a unidade base do catálogo. Devolve null quando não reconhece, porque
// comparar reais por quilo com reais por unidade daria um número errado — e
// número errado sobre dinheiro é pior que número nenhum.
export function normalizeBaseUnit(value: string | null | undefined): BaseUnit | null {
  if (!value) return null;
  const clean = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  if (["kg", "quilo", "quilos", "kilo", "quilograma", "quilogramas"].includes(clean)) return "kg";
  if (["l", "lt", "litro", "litros"].includes(clean)) return "l";
  if (
    ["un", "und", "unidade", "unidades", "pc", "pca", "peca", "pecas", "cx", "caixa"].includes(
      clean,
    )
  )
    return "un";
  return null;
}

// Preço por unidade base — a única comparação honesta entre embalagens de
// tamanhos diferentes.
export function pricePerBaseUnit(price: number | null, packSize: number) {
  if (price === null || !packSize) return null;
  return price / packSize;
}
