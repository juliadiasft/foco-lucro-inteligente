// Copia de seguranca do banco inteiro para um arquivo local.
//
// Uso:
//   SOURCE_DATABASE_URL="postgres://..." node scripts/db-backup.mjs backup.json
//
// Guarde o arquivo gerado FORA das duas plataformas antes de qualquer
// migracao. Se algo der errado no meio do caminho, e ele que salva.
//
// Para devolver este arquivo a um banco: scripts/db-restore.mjs
import { writeFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

import { exportarParaObjeto } from "./lib/copiar-tabelas.mjs";

const { Client } = pg;
const destino = process.argv[2] || `backup-${new Date().toISOString().slice(0, 10)}.json`;
const connectionString = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Defina SOURCE_DATABASE_URL com o endereco do banco de origem.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

try {
  const { dump, total } = await exportarParaObjeto(client);
  await writeFile(destino, JSON.stringify(dump, null, 1), "utf8");
  console.log(`\nBackup salvo em ${destino} — ${total} linha(s) no total.`);
  console.log("Guarde este arquivo fora do Railway e fora da Oracle.");
} finally {
  await client.end();
}
