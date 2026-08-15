// Leitura de planilha no próprio navegador. O arquivo não sobe para o
// servidor: só as linhas já interpretadas viajam, o que evita guardar
// arquivo e o custo de armazenamento que viria junto.

export type Sheet = { headers: string[]; rows: string[][] };

function detectDelimiter(line: string) {
  const candidates = [";", ",", "\t"] as const;
  let best: string = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    // Conta apenas separadores fora de aspas, senão um endereço com vírgula
    // dentro do texto engana a detecção.
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === candidate) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

export function parseSpreadsheet(text: string): Sheet {
  // O Excel salva CSV com marca de ordem de bytes; sem remover, a primeira
  // coluna do cabeçalho nunca casa com nada.
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n").find((line) => line.trim()) || "";
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);

  if (!rows.length) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

// Aceita "1.234,56", "1234.56", "R$ 12,90" e devolve número. Planilha
// brasileira usa vírgula decimal, e tratar isso errado transforma R$ 12,90
// em R$ 1290.
export function parseBrazilianNumber(value: string): number | null {
  if (!value) return null;
  const clean = value.replace(/[^\d,.-]/g, "").trim();
  if (!clean) return null;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;
  if (lastComma > lastDot) normalized = clean.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) normalized = clean.replace(/,/g, "");
  else normalized = clean.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const accentless = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// Tenta adivinhar a coluna pelos nomes mais comuns em planilha de comércio.
// O usuário sempre pode corrigir na tela antes de importar.
export function guessColumn(headers: string[], candidates: string[]) {
  const normalized = headers.map(accentless);
  for (const candidate of candidates) {
    const target = accentless(candidate);
    const exact = normalized.findIndex((header) => header === target);
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const target = accentless(candidate);
    const partial = normalized.findIndex((header) => header.includes(target));
    if (partial >= 0) return partial;
  }
  return -1;
}
