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
import process from "node:process";
import pg from "pg";

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

// Tabelas que o proprio destino preenche e que nao devem vir junto.
const ignorar = new Set(["app_migrations"]);

try {
  const tabelas = (
    await fonte.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'`,
    )
  ).rows
    .map((row) => row.table_name)
    .filter((nome) => !ignorar.has(nome));

  // Ordem de insercao respeitando as chaves estrangeiras. Calculada a partir
  // do proprio banco, e nao de uma lista escrita a mao que envelheceria a
  // cada migracao nova.
  const dependencias = (
    await fonte.query(
      `SELECT tc.table_name AS filho, ccu.table_name AS pai
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`,
    )
  ).rows;

  const pais = new Map(tabelas.map((nome) => [nome, new Set()]));
  for (const { filho, pai } of dependencias) {
    if (filho === pai) continue; // auto-referencia nao muda a ordem
    if (pais.has(filho) && pais.has(pai)) pais.get(filho).add(pai);
  }

  const ordem = [];
  const pendentes = new Set(tabelas);
  while (pendentes.size) {
    const prontas = [...pendentes].filter((nome) =>
      [...pais.get(nome)].every((pai) => !pendentes.has(pai)),
    );
    if (!prontas.length) {
      // Ciclo entre tabelas: segue na ordem alfabetica e avisa.
      console.warn("Aviso: dependencia circular detectada, seguindo em ordem alfabetica.");
      ordem.push(...[...pendentes].sort());
      break;
    }
    prontas.sort();
    ordem.push(...prontas);
    for (const nome of prontas) pendentes.delete(nome);
  }

  console.log(`Copiando ${ordem.length} tabela(s)...\n`);
  const resumo = [];

  for (const tabela of ordem) {
    const dados = await fonte.query(`SELECT * FROM "${tabela}"`);
    if (!dados.rows.length) {
      resumo.push({ tabela, origem: 0, destino: 0 });
      console.log(`${tabela}: vazia`);
      continue;
    }

    const colunas = Object.keys(dados.rows[0]);
    const lista = colunas.map((coluna) => `"${coluna}"`).join(",");

    // Em lotes: uma unica instrucao com milhares de linhas estoura o limite
    // de parametros do Postgres.
    const LOTE = 200;
    for (let inicio = 0; inicio < dados.rows.length; inicio += LOTE) {
      const fatia = dados.rows.slice(inicio, inicio + LOTE);
      const valores = [];
      const marcadores = fatia
        .map((linha, indiceLinha) => {
          const posicoes = colunas.map((coluna, indiceColuna) => {
            valores.push(linha[coluna]);
            return `$${indiceLinha * colunas.length + indiceColuna + 1}`;
          });
          return `(${posicoes.join(",")})`;
        })
        .join(",");
      await alvo.query(
        `INSERT INTO "${tabela}" (${lista}) VALUES ${marcadores} ON CONFLICT DO NOTHING`,
        valores,
      );
    }

    const conferencia = await alvo.query(`SELECT count(*)::int total FROM "${tabela}"`);
    resumo.push({ tabela, origem: dados.rows.length, destino: conferencia.rows[0].total });
    console.log(`${tabela}: ${dados.rows.length} -> ${conferencia.rows[0].total}`);
  }

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
