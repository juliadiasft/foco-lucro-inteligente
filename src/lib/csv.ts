type CsvCell = string | number | null | undefined;

function escapeCell(value: CsvCell) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
