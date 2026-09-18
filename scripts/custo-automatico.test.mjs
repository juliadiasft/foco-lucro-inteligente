// O custo do produto chegando sozinho, sem sobrescrever o que a pessoa digitou.
//
//   node scripts/custo-automatico.test.mjs
//
// O risco desta etapa é dinheiro errado na tela de quem decide preço:
// estimativa apresentada como fato, custo por quilo gravado onde deveria ser
// custo por saco, ou o que a pessoa digitou trocado sem ela ver. O teste roda
// as regras puras e depois o núcleo contra um banco de verdade, com as
// migrações aplicadas.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const {
  avisoDeCustoEstimado,
  custoPorUnidade,
  decidirCusto,
  frasePagaPorOrigem,
  unidadeCompativel,
} = await import("../src/lib/custo-automatico.ts");
const {
  sincronizarCustoEstimado,
  registrarCustoDaCompra,
  aceitarCustoSugerido,
  dispensarCustoSugerido,
} = await import("../src/lib/server/custo-automatico.server.ts");

console.log("--- regras puras ---");
ok(custoPorUnidade(120, 15) === 8, "saco de 15 kg a R$ 120 custa R$ 8 o quilo");
ok(
  custoPorUnidade(0, 15) === null && custoPorUnidade(120, 0) === null,
  "preço ou embalagem zero não vira custo",
);
ok(
  unidadeCompativel("KG", "kg") && !unidadeCompativel("un", "kg"),
  "unidade do produto tem de ser a do catálogo",
);
const d = (atual, origemAtual, novo, origemNovo) =>
  decidirCusto({ atual, origemAtual, novo, origemNovo });
ok(d(0, "digitado", 8, "estimado") === "aplicar", "sem custo nenhum, o estimado entra");
ok(
  d(10, "digitado", 10.4, "estimado") === "aplicar",
  "digitado com diferença de 4% aceita o automático",
);
ok(
  d(10, "digitado", 12, "estimado") === "sugerir",
  "digitado com diferença de 20% vira sugestão, não troca",
);
ok(d(10, "digitado", 10, "estimado") === "ignorar", "mesmo valor da tabela não muda nada");
ok(
  d(10, "digitado", 10, "real") === "aplicar",
  "compra que confirma o digitado marca a origem como real",
);
ok(d(10, "real", 6, "estimado") === "ignorar", "palpite da tabela nunca rebaixa custo de compra");
ok(d(10, "estimado", 9, "estimado") === "aplicar", "estimado é trocado por estimado novo");
ok(d(10, "estimado", 11, "real") === "aplicar", "compra troca o estimado direto");
ok(d(10, "real", 12, "real") === "aplicar", "última compra vale, a anterior sai");
ok(d(10, "real", 10, "real") === "ignorar", "mesma compra de novo não muda nada");
ok(d(10, "digitado", 0, "real") === "ignorar", "custo zero nunca entra");

const db = new PGlite();
for (const arquivo of (await readdir(path.resolve("migrations")))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile(path.resolve("migrations", arquivo), "utf8"));
}

const empresa = async (nome, tipo) =>
  (
    await db.query(
      `INSERT INTO companies (name, account_type, plan, city, uf)
       VALUES ($1,$2,'profissional','CAMPINAS','SP') RETURNING id`,
      [nome, tipo],
    )
  ).rows[0].id;

const loja = await empresa("Pet Shop da Ana", "comerciante");
const outraLoja = await empresa("Outra Loja", "comerciante");
const forn1 = await empresa("Distribuidora A", "fornecedor");
const forn2 = await empresa("Distribuidora B", "fornecedor");
for (const f of [forn1, forn2])
  await db.query(
    "INSERT INTO supplier_profiles (company_id, display_name, published) VALUES ($1,'x',true)",
    [f],
  );

const item = async (nome, chave, unidade) =>
  (
    await db.query(
      "INSERT INTO catalog_items (name, base_unit, search_key) VALUES ($1,$3,$2) RETURNING id",
      [nome, chave, unidade],
    )
  ).rows[0].id;
const racao = await item("Racao Adulto Frango", "racao adulto frango", "kg");
const areiaKg = await item("Areia Higienica", "areia higienica", "kg");
const areiaUn = await item("Areia Higienica", "areia higienica", "un");

const oferta = async (forn, cat, pack, preco) =>
  (
    await db.query(
      `INSERT INTO supplier_offerings (company_id, catalog_item_id, pack_size, price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [forn, cat, pack, preco],
    )
  ).rows[0].id;
const ofertaA = await oferta(forn1, racao, 15, 120); // R$ 8,00/kg
await oferta(forn2, racao, 10, 100); // R$ 10,00/kg
await oferta(forn1, areiaKg, 4, 20);
await oferta(forn1, areiaUn, 1, 20);

const produto = async (empresaId, nome, custo, unidade = "kg") =>
  (
    await db.query(
      `INSERT INTO products (company_id, name, cost_price, sale_price, unit)
       VALUES ($1,$2,$3,20,$4) RETURNING id`,
      [empresaId, nome, custo, unidade],
    )
  ).rows[0].id;
const le = async (id) =>
  (
    await db.query(
      `SELECT cost_price::text c, cost_source s, cost_suggested::text sug,
              cost_suggested_source ss, catalog_item_id ci FROM products WHERE id=$1`,
      [id],
    )
  ).rows[0];

console.log("\n--- estimado pela tabela ---");
const semCusto = await produto(loja, "Ração Adulto Frango", 0);
await sincronizarCustoEstimado(db, { empresa: loja });
let p = await le(semCusto);
ok(p.ci === racao, "o produto foi ligado ao item do catálogo pelo nome");
// Mediana de 8 e 10 = 9. O menor (8) faria toda margem parecer maior.
ok(
  Number(p.c) === 9 && p.s === "estimado",
  `custo = mediana das tabelas, marcado estimado (${p.c}/${p.s})`,
);

console.log("\n--- o que a pessoa digitou não é trocado em silêncio ---");
const digitado = await produto(loja, "Ração Adulto Frango Premium", 0);
await db.query(
  "UPDATE products SET name='Ração Adulto Frango', sku='b', cost_price=7, cost_source='digitado' WHERE id=$1",
  [digitado],
);
await sincronizarCustoEstimado(db, { empresa: loja });
p = await le(digitado);
ok(Number(p.c) === 7 && p.s === "digitado", `custo digitado 7 continua 7 (${p.c}/${p.s})`);
ok(Number(p.sug) === 9 && p.ss === "estimado", `o 9 da tabela ficou como sugestão (${p.sug})`);

console.log("\n--- recusar não faz a pergunta voltar ---");
ok(await dispensarCustoSugerido(db, loja, digitado), "recusa aceita");
await sincronizarCustoEstimado(db, { empresa: loja });
p = await le(digitado);
ok(p.sug === null, "o mesmo 9 não é sugerido de novo");

console.log("\n--- aceitar vira custo estimado ---");
await db.query("UPDATE products SET cost_dismissed=NULL WHERE id=$1", [digitado]);
await sincronizarCustoEstimado(db, { empresa: loja });
ok(await aceitarCustoSugerido(db, loja, digitado), "aceite funciona");
p = await le(digitado);
ok(
  Number(p.c) === 9 && p.s === "estimado" && p.sug === null,
  `custo virou 9, estimado, sem sugestão (${p.c}/${p.s})`,
);
ok(
  !(await aceitarCustoSugerido(db, outraLoja, digitado)),
  "outra empresa não aceita o custo dos outros",
);

console.log("\n--- compra concluída vira custo real ---");
const pedido = (
  await db.query(
    `INSERT INTO purchase_orders (merchant_company_id, supplier_company_id, status, total)
     VALUES ($1,$2,'concluido',240) RETURNING id`,
    [loja, forn1],
  )
).rows[0].id;
await db.query(
  `INSERT INTO purchase_order_items
     (order_id, offering_id, item_name, base_unit, pack_size, quantity, unit_price, subtotal)
   VALUES ($1,$2,'Racao Adulto Frango','kg',15,2,120,240)`,
  [pedido, ofertaA],
);
const mudou = await registrarCustoDaCompra(db, pedido);
p = await le(semCusto);
ok(mudou >= 1, `a compra mexeu nos produtos ligados (${mudou})`);
ok(Number(p.c) === 8 && p.s === "real", `saco de 15 kg a R$ 120 → R$ 8/kg, real (${p.c}/${p.s})`);

console.log("\n--- tabela nova não rebaixa custo de compra ---");
await db.query("UPDATE supplier_offerings SET price=60 WHERE id=$1", [ofertaA]);
await sincronizarCustoEstimado(db, { catalogItemId: racao });
p = await le(semCusto);
ok(Number(p.c) === 8 && p.s === "real", `continua 8, real (${p.c}/${p.s})`);

console.log("\n--- cuidados ---");
const emUn = await produto(outraLoja, "Ração Adulto Frango", 0, "un");
await sincronizarCustoEstimado(db, { empresa: outraLoja });
p = await le(emUn);
ok(
  Number(p.c) === 0 && p.s === "digitado",
  "produto em 'un' contra tabela em 'kg' não recebe custo (fator errado)",
);
const ambiguo = await produto(outraLoja, "Areia Higiênica", 0, "kg");
await sincronizarCustoEstimado(db, { empresa: outraLoja });
p = await le(ambiguo);
ok(
  p.ci === null && Number(p.c) === 0,
  "nome que casa com dois itens do catálogo fica sem vínculo, em vez de chutar",
);
const sozinho = await produto(outraLoja, "Produto que ninguém vende", 0);
await sincronizarCustoEstimado(db, { empresa: outraLoja });
ok(Number((await le(sozinho)).c) === 0, "sem tabela publicada, sem custo inventado");

await db.query("UPDATE supplier_profiles SET published=false");
const naoPublicado = await produto(loja, "Ração Adulto Frango", 0);
await db.query("UPDATE products SET sku='z', cost_price=0 WHERE id=$1", [naoPublicado]);
await sincronizarCustoEstimado(db, { empresa: loja });
ok(Number((await le(naoPublicado)).c) === 0, "tabela de fornecedor não publicado não conta");

ok(
  frasePagaPorOrigem.estimado.startsWith("Seu custo estimado") &&
    frasePagaPorOrigem.digitado === "Você paga" &&
    !frasePagaPorOrigem.real.startsWith("Você paga "),
  'Painel só diz "você paga" quando o custo foi digitado; estimativa não vira fato',
);
ok(
  avisoDeCustoEstimado("estimado").includes("estimado") &&
    avisoDeCustoEstimado("real") === "" &&
    avisoDeCustoEstimado("digitado") === "",
  "aviso de custo estimado só aparece na margem calculada sobre estimativa",
);

console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo");
process.exit(falhas.length ? 1 : 0);
