// Teste da copia entre bancos, com dois Postgres reais.
//
//   node scripts/db-copy.test.mjs
//
// Usa PGlite (o mesmo Postgres compilado para WASM que o projeto ja carrega
// no ambiente local) para levantar uma origem e um destino de verdade, aplica
// as migracoes reais do projeto nos dois e exercita scripts/lib/copiar-tabelas.
// A migracao para o Neon acontece uma vez so e nao tem ensaio — entao o ensaio
// e aqui.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

import {
  ajustarSequences,
  copiarTabelas,
  exportarParaObjeto,
  importarDeObjeto,
  ordenarPorDependencia,
} from "./lib/copiar-tabelas.mjs";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

async function migrar(db, rotulo) {
  const dir = path.resolve("migrations");
  const arquivos = (await readdir(dir)).filter((nome) => nome.endsWith(".sql")).sort();
  for (const arquivo of arquivos) {
    await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
  }
  console.log(`${rotulo}: ${arquivos.length} migracoes aplicadas`);
}

const origem = new PGlite();
const destino = new PGlite();
await migrar(origem, "origem ");
await migrar(destino, "destino");

const empresaA = (
  await origem.query(
    `INSERT INTO companies (name, account_type, city, uf, plan)
     VALUES ('Pet Shop do Bairro','comerciante','Uberlandia','MG','profissional') RETURNING id`,
  )
).rows[0].id;
const empresaB = (
  await origem.query(
    `INSERT INTO companies (name, account_type, city, uf, plan)
     VALUES ('Distribuidora Racao Sul','fornecedor','Curitiba','PR','premium') RETURNING id`,
  )
).rows[0].id;

await origem.query(
  `INSERT INTO users (company_id, name, email, password_hash, role)
   VALUES ($1,'Julia','julia@exemplo.com','$2a$10$hashfalsoparateste','owner'),
          ($2,'Marcos','marcos@exemplo.com','$2a$10$outrohashfalsoteste','owner')`,
  [empresaA, empresaB],
);

// Volume que atravessa a fronteira do lote de 200 linhas.
const produtos = [];
for (let indice = 1; indice <= 450; indice += 1) {
  produtos.push(
    `('${empresaA}','Produto ${indice}','un',${(indice % 90) + 10},${(indice % 90) + 25},${indice % 40})`,
  );
}
await origem.exec(
  `INSERT INTO products (company_id, name, unit, cost_price, sale_price, stock)
   VALUES ${produtos.join(",")}`,
);

// Conversa entre as duas empresas, com mensagem — exercita uma tabela que
// depende de outra que tambem depende de companies.
const conversa = (
  await origem.query(
    `INSERT INTO conversations (merchant_company_id, supplier_company_id)
     VALUES ($1,$2) RETURNING id`,
    [empresaA, empresaB],
  )
).rows[0].id;
const autor = (await origem.query(`SELECT id FROM users WHERE email='julia@exemplo.com'`)).rows[0]
  .id;
await origem.query(
  `INSERT INTO messages (conversation_id, sender_company_id, sender_user_id, body)
   VALUES ($1,$2,$3,'Tem racao premium 15kg em estoque?')`,
  [conversa, empresaA, autor],
);

console.log("\n--- ordem calculada pelas chaves estrangeiras ---");
const tabelas = (
  await origem.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`,
  )
).rows
  .map((linha) => linha.table_name)
  .filter((nome) => nome !== "app_migrations");
const ordem = await ordenarPorDependencia(origem, tabelas);
ok(ordem.indexOf("companies") < ordem.indexOf("users"), "companies antes de users");
ok(ordem.indexOf("companies") < ordem.indexOf("products"), "companies antes de products");
ok(ordem.length === tabelas.length, `as ${tabelas.length} tabelas entraram na ordem`);

console.log("\n--- copia ---");
const resumo = await copiarTabelas(origem, destino, { log: () => {} });
await ajustarSequences(destino, () => {});
const divergentes = resumo.filter((item) => item.origem !== item.destino);
for (const item of divergentes)
  console.log(`      ${item.tabela}: ${item.origem} != ${item.destino}`);
ok(divergentes.length === 0, `nenhuma tabela divergente (${resumo.length} conferidas)`);
ok(
  resumo.reduce((soma, item) => soma + item.origem, 0) > 450,
  `${resumo.reduce((soma, item) => soma + item.origem, 0)} linhas copiadas`,
);

console.log("\n--- conteudo, nao so contagem ---");
const somaDestino = await destino.query(`SELECT sum(cost_price)::text soma FROM products`);
const somaOrigem = await origem.query(`SELECT sum(cost_price)::text soma FROM products`);
ok(
  somaDestino.rows[0].soma === somaOrigem.rows[0].soma,
  `soma dos custos identica (${somaOrigem.rows[0].soma})`,
);

const empresas = await destino.query(
  `SELECT name, account_type, city, plan FROM companies ORDER BY name`,
);
ok(
  empresas.rows[0].account_type === "fornecedor" && empresas.rows[0].city === "Curitiba",
  "fornecedor chegou com account_type e cidade certos",
);
ok(
  empresas.rows[1].city === "Uberlandia" && empresas.rows[1].plan === "profissional",
  "comerciante chegou com cidade e plano certos",
);

const vinculo = await destino.query(
  `SELECT u.email, c.name FROM users u JOIN companies c ON c.id = u.company_id`,
);
ok(
  vinculo.rows.some((l) => l.email === "julia@exemplo.com" && l.name === "Pet Shop do Bairro") &&
    vinculo.rows.some(
      (l) => l.email === "marcos@exemplo.com" && l.name === "Distribuidora Racao Sul",
    ),
  "cada usuario continua ligado a sua propria empresa",
);

console.log("\n--- rodar de novo nao duplica ---");
const repeticao = await copiarTabelas(origem, destino, { log: () => {} });
ok(
  repeticao.every((item) => item.destino === item.origem),
  "segunda passada mantem as mesmas contagens",
);

console.log("\n--- o destino continua utilizavel ---");
const nova = await destino.query(
  `INSERT INTO products (company_id, name, unit, cost_price, sale_price)
   VALUES ($1,'Item pos-migracao','un',10,20) RETURNING id`,
  [empresaA],
);
ok(!!nova.rows[0].id, "insert novo funciona depois da copia");

const origemDepois = await origem.query(`SELECT count(*)::int total FROM products`);
ok(origemDepois.rows[0].total === 450, "a origem nao foi tocada");

console.log("\n--- backup e restauracao (o caminho de volta) ---");
const { dump, total } = await exportarParaObjeto(origem, () => {});
// Passa por JSON de verdade: e assim que o arquivo chega ao disco e volta.
const doArquivo = JSON.parse(JSON.stringify(dump));
const resgate = new PGlite();
await migrar(resgate, "resgate");
const restaurado = await importarDeObjeto(resgate, doArquivo, { log: () => {} });
await ajustarSequences(resgate, () => {});

const faltando = restaurado.filter((item) => item.origem !== item.destino);
for (const item of faltando) console.log(`      ${item.tabela}: ${item.origem} != ${item.destino}`);
ok(faltando.length === 0, `backup restaurado inteiro (${total} linhas)`);

const somaResgate = await resgate.query(`SELECT sum(cost_price)::text soma FROM products`);
ok(
  somaResgate.rows[0].soma === somaOrigem.rows[0].soma,
  "valores em numeric sobreviveram a ida e volta pelo JSON",
);

const datas = await resgate.query(
  `SELECT created_at FROM companies WHERE name='Pet Shop do Bairro'`,
);
const datasOrigem = await origem.query(
  `SELECT created_at FROM companies WHERE name='Pet Shop do Bairro'`,
);
ok(
  new Date(datas.rows[0].created_at).getTime() ===
    new Date(datasOrigem.rows[0].created_at).getTime(),
  "timestamptz sobreviveu a ida e volta pelo JSON",
);

const msgResgate = await resgate.query(
  `SELECT m.body, c.name FROM messages m
     JOIN companies c ON c.id = m.sender_company_id`,
);
ok(
  msgResgate.rows[0]?.name === "Pet Shop do Bairro" &&
    msgResgate.rows[0]?.body.startsWith("Tem racao"),
  "mensagem restaurada ainda pertence a empresa que a enviou",
);

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
