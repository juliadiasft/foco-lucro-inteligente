// Devolve um arquivo gerado por scripts/db-backup.mjs para um banco.
//
// Uso:
//   DATABASE_URL="postgres://..." node scripts/db-restore.mjs backup.json
//
// O esquema precisa existir antes (node scripts/migrate.mjs). O script so
// insere: nao apaga nem sobrescreve nada que ja esteja la.
//
// Este e o caminho de volta do roteiro em docs/migracao.md. Backup que
// ninguem consegue restaurar nao e ponto de retorno.
import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

import { ajustarSequences, importarDeObjeto } from "./lib/copiar-tabelas.mjs";

const { Client } = pg;
const arquivo = process.argv[2];
const connectionString = process.env.DATABASE_URL;

if (!arquivo || !connectionString) {
  console.error("Uso: DATABASE_URL='postgres://...' node scripts/db-restore.mjs backup.json");
  process.exit(1);
}

const dump = JSON.parse(await readFile(arquivo, "utf8"));
if (!dump?.tabelas) {
  console.error(`${arquivo} nao parece um backup gerado por scripts/db-backup.mjs.`);
  process.exit(1);
}
console.log(`Backup de ${dump.geradoEm}, ${Object.keys(dump.tabelas).length} tabela(s).`);

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

try {
  const resumo = await importarDeObjeto(client, dump);
  await ajustarSequences(client);

  console.log("\n--- CONFERENCIA ---");
  const divergentes = resumo.filter((item) => item.origem !== item.destino);
  if (divergentes.length) {
    console.error("DIVERGENCIA entre o arquivo e o banco:");
    for (const item of divergentes)
      console.error(`  ${item.tabela}: arquivo ${item.origem}, banco ${item.destino}`);
    process.exitCode = 1;
  } else {
    const total = resumo.reduce((soma, item) => soma + item.origem, 0);
    console.log(`Todas as ${resumo.length} tabelas conferem. ${total} linha(s) restaurada(s).`);
  }
} finally {
  await client.end();
}
