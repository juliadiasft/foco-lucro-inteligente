// Quando o fornecedor é avisado de que cobra acima da região.
//
//   node scripts/preco-regiao.test.mjs
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { precoAcimaDaRegiao } = await import("../src/lib/preco-regiao.ts");
const r = (meuPreco, medianaDosOutros, concorrentes) =>
  precoAcimaDaRegiao({ meuPreco, medianaDosOutros, concorrentes });

const acima = r(12, 10, 3);
ok(
  acima !== null && acima.diferenca === 2 && Math.round(acima.percentual) === 20,
  "R$ 12 contra mediana de R$ 10 está R$ 2 (20%) acima",
);
ok(r(12, 10, 1) === null, "um concorrente só não é região: não avisa");
ok(r(10.4, 10, 3) === null, "4% acima é ruído: não avisa");
ok(r(10.5, 10, 3) === null, "exatamente 5% ainda não avisa");
ok(r(9, 10, 3) === null, "abaixo da mediana nunca avisa");
ok(r(12, 0, 3) === null && r(0, 10, 3) === null, "preço zero não vira aviso");

console.log("\n--- a consulta, contra um banco de verdade ---");
const { precosAcimaDaRegiao } = await import("../src/lib/server/preco-regiao.server.ts");
const db = new PGlite();
for (const arquivo of (await readdir(path.resolve("migrations")))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile(path.resolve("migrations", arquivo), "utf8"));
}
const forn = async (nome, uf, publicado = true) => {
  const id = (
    await db.query(
      `INSERT INTO companies (name, account_type, plan, city, uf)
       VALUES ($1,'fornecedor','profissional','X',$2) RETURNING id`,
      [nome, uf],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO supplier_profiles (company_id, display_name, published) VALUES ($1,'x',$2)",
    [id, publicado],
  );
  return id;
};
const racao = (
  await db.query(
    "INSERT INTO catalog_items (name, base_unit, search_key) VALUES ('Racao X','kg','racao x') RETURNING id",
  )
).rows[0].id;
const areia = (
  await db.query(
    "INSERT INTO catalog_items (name, base_unit, search_key) VALUES ('Areia Y','kg','areia y') RETURNING id",
  )
).rows[0].id;
const oferta = (empresa, cat, pack, preco) =>
  db.query(
    "INSERT INTO supplier_offerings (company_id, catalog_item_id, pack_size, price) VALUES ($1,$2,$3,$4)",
    [empresa, cat, pack, preco],
  );
const eu = await forn("Eu", "SP");
const a = await forn("Concorrente A", "SP");
const b = await forn("Concorrente B", "SP");
const longe = await forn("Concorrente MG", "MG");
const rascunho = await forn("Nao publicado", "SP", false);
await oferta(eu, racao, 10, 120); // R$ 12/kg
await oferta(a, racao, 10, 100); // R$ 10/kg
await oferta(b, racao, 10, 100); // R$ 10/kg
await oferta(longe, racao, 10, 50); // outra UF: não conta
await oferta(rascunho, racao, 10, 10); // não publicado: não conta
await oferta(eu, areia, 1, 5);
await oferta(a, areia, 1, 4); // só um concorrente em areia: não avisa
const res = await precosAcimaDaRegiao(db, eu);
ok(res.itens.length === 1 && res.itens[0].item === "Racao X", "avisa só da ração");
ok(
  res.itens[0].meuPreco === 12 && res.itens[0].medianaDosOutros === 10,
  "R$ 12/kg contra mediana de R$ 10/kg, sem contar outra UF nem tabela não publicada",
);
ok(res.itens[0].concorrentes === 2, "dois concorrentes da região");
ok(res.regiao === "SP", "diz de qual região fala");

console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo");
process.exit(falhas.length ? 1 : 0);
