// Testa a vitrine pública do fornecedor contra um banco de verdade.
//
//   node scripts/vitrine-publica.test.mjs
//
// O que precisa continuar valendo:
//   - o endereço nasce legível e é único
//   - vitrine despublicada não vaza
//   - telefone, email e preço NÃO saem na consulta pública
//
// Esse último é o ponto delicado: é fácil alguém "melhorar" a consulta um dia
// adicionando o telefone para facilitar o contato, e transformar a página num
// alvo de robô de spam sem perceber.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const db = new PGlite();
const dir = path.resolve("migrations");
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
}
const uma = async (sql, params) => (await db.query(sql, params)).rows[0];

console.log("--- o backfill da migração gera endereço legível ---");

const criarFornecedor = async (nome, cidade, uf) =>
  (
    await db.query(
      `INSERT INTO companies (name,account_type,city,uf,plan)
       VALUES ($1,'fornecedor',$2,$3,'essencial') RETURNING id`,
      [nome, cidade, uf],
    )
  ).rows[0].id;

// Nome com acento, maiúscula e pontuação: o caso que quebra slug ingênuo.
const a = await criarFornecedor("Atacadão Pet Sul", "Campinas", "SP");
const b = await criarFornecedor("Atacadão Pet Sul", "Ribeirão Preto", "SP");
await db.query(
  `INSERT INTO supplier_profiles (company_id,display_name,published) VALUES
     ($1,'Atacadão Pet Sul',true), ($2,'Atacadão Pet Sul',false)`,
  [a, b],
);

// Reproduz o backfill da 023 sobre as linhas recém-criadas.
await db.exec(`
  WITH base AS (
    SELECT company_id,
           nullif(trim(both '-' from regexp_replace(
             lower(translate(coalesce(display_name,''),
               'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
               'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
             '[^a-z0-9]+','-','g')), '') AS raw
      FROM supplier_profiles WHERE slug IS NULL
  ), numerado AS (
    SELECT company_id, coalesce(raw,'fornecedor') raw,
           row_number() OVER (PARTITION BY coalesce(raw,'fornecedor') ORDER BY company_id) n
      FROM base
  )
  UPDATE supplier_profiles sp
     SET slug = CASE WHEN numerado.n = 1 THEN numerado.raw
                     ELSE numerado.raw || '-' || numerado.n END
    FROM numerado WHERE sp.company_id = numerado.company_id;
`);

const slugs = (
  await db.query(`SELECT company_id, slug FROM supplier_profiles ORDER BY slug`)
).rows;
ok(
  slugs.some((r) => r.slug === "atacadao-pet-sul"),
  `acento e maiúscula viram endereço limpo: ${slugs[0].slug}`,
);
ok(
  new Set(slugs.map((r) => r.slug)).size === slugs.length,
  `dois fornecedores de mesmo nome ficam com endereços diferentes: ${slugs.map((r) => r.slug).join(", ")}`,
);

console.log("\n--- o índice único recusa endereço repetido ---");
let recusou = false;
try {
  await db.query(`UPDATE supplier_profiles SET slug='atacadao-pet-sul' WHERE company_id=$1`, [b]);
} catch {
  recusou = true;
}
ok(recusou, "o banco barra duas vitrines no mesmo endereço");

console.log("\n--- a consulta pública ---");

// Mesma consulta da public-supplier.functions.ts. Se ela mudar lá e não aqui,
// este teste para de proteger o que se propõe a proteger.
const publica = (slug) =>
  uma(
    `SELECT coalesce(sp.display_name,c.name) nome, c.city cidade, c.uf,
            sp.delivery_days prazo, sp.minimum_order pedido_minimo
       FROM supplier_profiles sp
       JOIN companies c ON c.id=sp.company_id
      WHERE sp.slug=$1 AND sp.published=true AND c.account_type='fornecedor'`,
    [slug],
  );

const visivel = await publica("atacadao-pet-sul");
ok(Boolean(visivel), "vitrine publicada responde");
ok(visivel?.cidade === "Campinas", `traz a cidade: ${visivel?.cidade}`);

const oculta = await publica(slugs.find((r) => r.company_id === b).slug);
ok(oculta === undefined, "vitrine despublicada não responde nada");

console.log("\n--- o que NÃO pode sair na página pública ---");
const colunas = Object.keys(visivel || {});
ok(!colunas.includes("public_phone"), "telefone não sai");
ok(!colunas.includes("public_email"), "email não sai");
ok(!colunas.includes("price"), "preço não sai");

console.log("\n--- o comerciante nunca aparece como vitrine ---");
const comerciante = (
  await db.query(
    `INSERT INTO companies (name,account_type,plan) VALUES ('Mercadinho','comerciante','essencial')
     RETURNING id`,
  )
).rows[0].id;
await db.query(
  `INSERT INTO supplier_profiles (company_id,display_name,published,slug)
   VALUES ($1,'Mercadinho',true,'mercadinho')`,
  [comerciante],
);
ok(
  (await publica("mercadinho")) === undefined,
  "conta de comerciante não vira vitrine mesmo com perfil publicado",
);

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
