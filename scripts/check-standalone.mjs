// Execute antes de extrair: uma cópia antiga no pacote não pode vencer silenciosamente.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const archive = "standalone-update.tar.gz";
const files = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split(/\r?\n/);
for (const file of files) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.resolve() + path.sep) || file.endsWith("/")) {
    throw new Error(`Entrada inválida no pacote: ${file}`);
  }
  const packed = execFileSync("tar", ["-xOf", archive, file], { maxBuffer: 16 * 1024 * 1024 });
  if (!packed.equals(readFileSync(resolved))) {
    throw new Error(
      `Pacote desatualizado: ${file}. Regenere standalone-update.tar.gz antes de publicar.`,
    );
  }
}
console.log(`Pacote consistente: ${files.length} arquivos conferidos byte a byte.`);
