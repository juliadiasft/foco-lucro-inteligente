// Copia os dados de um banco para outro e confere linha por linha.
//
// Uso:
//   SOURCE_DATABASE_URL="postgres://railway..." \
//   DATABASE_URL="postgres://neon..." \
//   node scripts/db-copy.mjs
//
// O esquema do destino precisa ter sido criado ANTES, com:
//   DATABASE_URL="postgres://neon..." node scripts/migrate.mjs
//
// Fazer assim, em vez de restaurar um dump, garante que o esquema do destino
// e exatamente o que as migracoes do projeto descrevem — nao uma copia de um
// estado antigo que ninguem confere.
//
// A logica fica em scripts/lib/copiar-tabelas.mjs para ser exercitada pelos
// testes; aqui so montamos as conexoes reais.
import process from "node:process";
import pg from "pg";

import { ajustarSequences, copiarTabelas } from "./lib/copiar-tabelas.mjs";

const { Client } = pg;
const origem = process.env.SOURCE_DATABASE_URL;
const destino = process.env.DATABASE_URL;

if (!origem || !destino) {
  console.error("Defina SOURCE_DATABASE_URL (origem) e DATABASE_URL (destino).");
  process.exit(1);
}
if (origem === destino) {
  console.error("Origem e destino sao o mesmo banco. Abortando.");
  process.exit(1);
}

const conectar = (connectionString) =>
  new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

const fonte = conectar(origem);
const alvo = conectar(destino);
await fonte.connect();
await alvo.connect();

try {
  const resumo = await copiarTabelas(fonte, alvo);
  await ajustarSequences(alvo);

  console.log("\n--- CONFERENCIA ---");
  const divergentes = resumo.filter((item) => item.origem !== item.destino);
  if (divergentes.length) {
    console.error("DIVERGENCIA encontrada. NAO desligue a origem:");
    for (const item of divergentes)
      console.error(`  ${item.tabela}: origem ${item.origem}, destino ${item.destino}`);
    process.exitCode = 1;
  } else {
    const total = resumo.reduce((soma, item) => soma + item.origem, 0);
    console.log(`Todas as ${resumo.length} tabelas conferem. ${total} linha(s) copiada(s).`);
  }
} finally {
  await fonte.end();
  await alvo.end();
}
