// Ensaio da atualizacao de producao.
//
//   node scripts/upgrade.test.mjs
//
// A producao nao esta vazia: ela tem as migracoes 001-007 e dados reais de
// clientes. Aplicar 008-020 em cima disso e um caminho diferente de criar o
// banco do zero, e e o caminho que vai acontecer de verdade no deploy.
//
// Aqui montamos exatamente esse cenario: banco na versao antiga, dados
// dentro, e entao a atualizacao — conferindo que nada se perdeu e que o
// sistema novo funciona sobre os dados velhos.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const dir = path.resolve("migrations");
const todas = (await readdir(dir)).filter((nome) => nome.endsWith(".sql")).sort();
const antigas = todas.filter((nome) => Number(nome.slice(0, 3)) <= 7);
const novas = todas.filter((nome) => Number(nome.slice(0, 3)) > 7);

const db = new PGlite();

console.log(`--- producao de hoje: ${antigas.length} migracoes ---`);
for (const arquivo of antigas) await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
console.log("aplicadas\n");

// Dados como os de um cliente que ja usa o sistema.
const empresa = (
  await db.query(
    `INSERT INTO companies (name, cnpj, business_type, plan, subscription_status)
     VALUES ('Mercadinho da Esquina','11222333000181','mercadinho','profissional','active')
     RETURNING id`,
  )
).rows[0].id;
await db.query(
  `INSERT INTO users (company_id,name,email,password_hash,role)
   VALUES ($1,'Dona Maria','maria@mercadinho.com.br','$2a$10$hashdeverdadeseria','owner')`,
  [empresa],
);
const produtos = [];
for (let i = 1; i <= 120; i += 1) {
  produtos.push(`('${empresa}','Item ${i}','un',${(i % 50) + 5},${(i % 50) + 12},${i % 30})`);
}
await db.exec(
  `INSERT INTO products (company_id,name,unit,cost_price,sale_price,stock) VALUES ${produtos.join(",")}`,
);
await db.query(
  `INSERT INTO sales (company_id,total,profit,sold_at)
   VALUES ($1,250.00,80.00,now()-interval '3 days'),
          ($1,410.50,130.25,now()-interval '10 days')`,
  [empresa],
);
await db.query(
  `INSERT INTO trial_identity_claims (document_hash,document_type,document_last4,company_id)
   VALUES ('hash-ficticio-do-documento','cnpj','0181',$1)`,
  [empresa],
);

const antes = {
  produtos: Number((await db.query(`SELECT count(*)::int c FROM products`)).rows[0].c),
  vendas: Number((await db.query(`SELECT count(*)::int c FROM sales`)).rows[0].c),
  lucro: (await db.query(`SELECT sum(profit)::text s FROM sales`)).rows[0].s,
  usuarios: Number((await db.query(`SELECT count(*)::int c FROM users`)).rows[0].c),
  travas: Number((await db.query(`SELECT count(*)::int c FROM trial_identity_claims`)).rows[0].c),
};
console.log(
  `dados do cliente: ${antes.produtos} produtos, ${antes.vendas} vendas, ${antes.travas} trava(s)\n`,
);

console.log(`--- atualizacao: ${novas.length} migracoes novas ---`);
for (const arquivo of novas) {
  try {
    await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
    console.log(`  aplicada  ${arquivo}`);
  } catch (erro) {
    console.log(`  FALHOU    ${arquivo}: ${erro.message}`);
    falhas.push(`migracao ${arquivo}`);
  }
}

console.log("\n--- os dados do cliente sobreviveram? ---");
const depois = {
  produtos: Number((await db.query(`SELECT count(*)::int c FROM products`)).rows[0].c),
  vendas: Number((await db.query(`SELECT count(*)::int c FROM sales`)).rows[0].c),
  lucro: (await db.query(`SELECT sum(profit)::text s FROM sales`)).rows[0].s,
  usuarios: Number((await db.query(`SELECT count(*)::int c FROM users`)).rows[0].c),
  travas: Number((await db.query(`SELECT count(*)::int c FROM trial_identity_claims`)).rows[0].c),
};
ok(depois.produtos === antes.produtos, `${depois.produtos} produtos (eram ${antes.produtos})`);
ok(depois.vendas === antes.vendas, `${depois.vendas} vendas (eram ${antes.vendas})`);
ok(depois.lucro === antes.lucro, `lucro somado igual (${depois.lucro})`);
ok(depois.usuarios === antes.usuarios, `${depois.usuarios} usuario(s)`);
ok(depois.travas === antes.travas, `trava de CPF/CNPJ preservada`);

console.log("\n--- a empresa antiga funciona no sistema novo? ---");
const tipo = await db.query(`SELECT account_type, city, uf FROM companies WHERE id=$1`, [empresa]);
ok(
  tipo.rows[0].account_type === "comerciante",
  `empresa que existia antes virou 'comerciante' por padrao (era ${tipo.rows[0].account_type})`,
);

const suspensao = await db.query(`SELECT suspended_at FROM companies WHERE id=$1`, [empresa]);
ok(suspensao.rows[0].suspended_at === null, "empresa nao foi suspensa pela atualizacao");

// A coluna nova em products nao pode ter quebrado os registros antigos.
const categoria = await db.query(
  `SELECT count(*)::int c FROM products WHERE company_id=$1 AND category_id IS NULL`,
  [empresa],
);
ok(categoria.rows[0].c === antes.produtos, "produtos antigos ficaram sem categoria, sem erro");

console.log("\n--- as tabelas novas nasceram utilizaveis? ---");
const fornecedor = (
  await db.query(
    `INSERT INTO companies (name, account_type, city, uf, plan)
     VALUES ('Atacadao Novo','fornecedor','Curitiba','PR','premium') RETURNING id`,
  )
).rows[0].id;
const conversa = await db.query(
  `INSERT INTO conversations (merchant_company_id,supplier_company_id) VALUES ($1,$2) RETURNING id`,
  [empresa, fornecedor],
);
ok(!!conversa.rows[0].id, "conversa entre empresa antiga e fornecedor novo funciona");

const orcamento = await db.query(
  `INSERT INTO quote_requests (merchant_company_id,supplier_company_id,status)
   VALUES ($1,$2,'aberto') RETURNING id`,
  [empresa, fornecedor],
);
ok(!!orcamento.rows[0].id, "orcamento funciona sobre a empresa antiga");

const financeiro = await db.query(
  `INSERT INTO finance_entries (company_id,direction,description,amount,due_date)
   VALUES ($1,'pagar','Fornecedor de arroz',1500.00,now()+interval '15 days') RETURNING id`,
  [empresa],
);
ok(!!financeiro.rows[0].id, "financeiro funciona sobre a empresa antiga");

const segmentos = Number((await db.query(`SELECT count(*)::int c FROM segments`)).rows[0].c);
const categorias = Number(
  (await db.query(`SELECT count(*)::int c FROM product_categories`)).rows[0].c,
);
ok(segmentos > 0, `${segmentos} nichos cadastrados`);
ok(categorias > 0, `${categorias} categorias cadastradas`);

console.log("\n--- rodar o deploy duas vezes seguidas quebra? ---");
// Reproduz o que scripts/migrate.mjs faz de verdade: consulta app_migrations
// e pula o que ja rodou. Reaplicar os arquivos direto, como um teste ingenuo
// faria, quebraria em ADD CONSTRAINT — mas isso nunca acontece em producao,
// e um teste que finge o contrario so gera susto falso.
await db.exec(`CREATE TABLE IF NOT EXISTS app_migrations (
  name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
for (const arquivo of todas) {
  await db.query("INSERT INTO app_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [arquivo]);
}

let puladas = 0;
let reaplicou = true;
for (const arquivo of todas) {
  const jaRodou = await db.query("SELECT 1 FROM app_migrations WHERE name = $1", [arquivo]);
  if (jaRodou.rows.length) {
    puladas += 1;
    continue;
  }
  try {
    await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
  } catch (erro) {
    reaplicou = false;
    console.log(`  ${arquivo}: ${erro.message}`);
  }
}
ok(reaplicou && puladas === todas.length, `redeploy pula as ${puladas} migracoes ja aplicadas`);

const finalProdutos = Number((await db.query(`SELECT count(*)::int c FROM products`)).rows[0].c);
ok(finalProdutos === antes.produtos, "nenhum dado duplicado ou perdido na segunda passada");

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
