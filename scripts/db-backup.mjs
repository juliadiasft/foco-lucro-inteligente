// Copia de seguranca do banco inteiro para um arquivo local.
//
// Uso:
//   SOURCE_DATABASE_URL="postgres://..." node scripts/db-backup.mjs backup.json
//
// Guarde o arquivo gerado FORA das duas plataformas antes de qualquer
// migracao. Se algo der errado no meio do caminho, e ele que salva.
import { writeFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

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
  const tabelas = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name`,
  );

  const dump = { geradoEm: new Date().toISOString(), tabelas: {} };
  let total = 0;

  for (const { table_name: tabela } of tabelas.rows) {
    const linhas = await client.query(`SELECT * FROM "${tabela}"`);
    dump.tabelas[tabela] = linhas.rows;
    total += linhas.rows.length;
    console.log(`${tabela}: ${linhas.rows.length} linha(s)`);
  }

  await writeFile(destino, JSON.stringify(dump, null, 1), "utf8");
  console.log(`\nBackup salvo em ${destino} — ${total} linha(s) no total.`);
  console.log("Guarde este arquivo fora do Railway e fora da Oracle.");
} finally {
  await client.end();
}
