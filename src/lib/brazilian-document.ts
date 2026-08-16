export type BrazilianDocumentType = "cpf" | "cnpj";

export type ValidBrazilianDocument = {
  normalized: string;
  type: BrazilianDocumentType;
  last4: string;
};

export function normalizeBrazilianDocument(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function digitFor(weightedSum: number) {
  const remainder = weightedSum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const first = digitFor(
    digits.slice(0, 9).reduce((sum, digit, index) => sum + digit * (10 - index), 0),
  );
  const second = digitFor(
    digits.slice(0, 10).reduce((sum, digit, index) => sum + digit * (11 - index), 0),
  );
  return first === digits[9] && second === digits[10];
}

function cnpjCharacterValue(character: string) {
  return character.charCodeAt(0) - 48;
}

function isValidCnpj(value: string) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(.)\1{13}$/.test(value)) return false;
  const base = value.slice(0, 12);
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const first = digitFor(
    [...base].reduce(
      (sum, character, index) => sum + cnpjCharacterValue(character) * firstWeights[index],
      0,
    ),
  );
  const secondBase = `${base}${first}`;
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const second = digitFor(
    [...secondBase].reduce(
      (sum, character, index) => sum + cnpjCharacterValue(character) * secondWeights[index],
      0,
    ),
  );
  return value.endsWith(`${first}${second}`);
}

export function validateBrazilianDocument(value: string): ValidBrazilianDocument | null {
  const normalized = normalizeBrazilianDocument(value);
  const type: BrazilianDocumentType | null =
    normalized.length === 11 && /^\d+$/.test(normalized)
      ? "cpf"
      : normalized.length === 14
        ? "cnpj"
        : null;
  if (!type) return null;
  if (type === "cpf" ? !isValidCpf(normalized) : !isValidCnpj(normalized)) return null;
  return { normalized, type, last4: normalized.slice(-4) };
}

export function formatBrazilianDocumentInput(value: string) {
  const normalized = normalizeBrazilianDocument(value).slice(0, 14);
  if (/^\d{0,11}$/.test(normalized)) {
    return normalized
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return normalized
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, "$1.$2")
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, "$1.$2.$3")
    .replace(/\.([A-Z0-9]{3})([A-Z0-9])/, ".$1/$2")
    .replace(/\/([A-Z0-9]{4})(\d)/, "/$1-$2");
}

export function maskedBrazilianDocument(type: BrazilianDocumentType, last4: string) {
  return type === "cpf"
    ? `CPF •••.•••.${last4.slice(0, 2)}•-${last4.slice(-2)}`
    : `CNPJ ••.•••.•••/••${last4.slice(0, 2)}-${last4.slice(-2)}`;
}
