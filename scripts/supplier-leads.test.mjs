// Testa a indicacao de fornecedor: a tabela, a deduplicacao por empresa e a
// agregacao que o back office usa para decidir para quem ligar.
//
//   node scripts/supplier-leads.test.mjs
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
const db = new PGlite();
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
}
console.log("migracoes aplicadas\n");

async function criarEmpresa(nome, tipo, cidade, uf) {
  return (
    await db.query(
      `INSERT INTO companies (name,account_type,city,uf,plan) VALUES ($1,$2,$3,$4,'profissional') RETURNING id`,
      [nome, tipo, cidade, uf],
    )
  ).rows[0].id;
}

const petA = await criarEmpresa("Pet Shop A", "comerciante", "Uberlandia", "MG");
const petB = await criarEmpresa("Pet Shop B", "comerciante", "Uberlandia", "MG");
const petC = await criarEmpresa("Pet Shop C", "comerciante", "Araguari", "MG");

// Reproduz a normalizacao do servidor.
const chave = (v) =>
  v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function indicar(empresa, nome, cidade, produtos, busca) {
  await db.query(
    `INSERT INTO supplier_leads (company_id,supplier_name,supplier_key,city,uf,products,search_term)
     SELECT $1,$2,$3,coalesce($4,c.city),coalesce($5,c.uf),$6,$7 FROM companies c WHERE c.id=$1
     ON CONFLICT (company_id,supplier_key) DO UPDATE SET
       supplier_name=excluded.supplier_name,
       city=coalesce(excluded.city,supplier_leads.city),
       uf=coalesce(excluded.uf,supplier_leads.uf),
       products=coalesce(excluded.products,supplier_leads.products)`,
    [empresa, nome, chave(nome), cidade, null, produtos, busca ? chave(busca) : null],
  );
}

// Tres comerciantes citam a mesma distribuidora, escrita de tres formas.
await indicar(petA, "Atacadão Pet Sul", null, "ração", "ração premium");
await indicar(petB, "atacadao pet sul", null, "areia", "areia sanitária");
// Sem cidade informada: cai para a do proprio comerciante, que e Araguari.
await indicar(petC, "ATACADÃO  PET  SUL", null, null, "ração");
// E um cita outra empresa.
await indicar(petA, "Distribuidora Minas", null, "brinquedos", "brinquedo cachorro");

console.log("--- deduplicacao ---");
const total = Number((await db.query(`SELECT count(*)::int c FROM supplier_leads`)).rows[0].c);
ok(total === 4, `4 linhas gravadas (3 empresas x atacadao + 1 outra) — veio ${total}`);

// A mesma empresa insistindo no mesmo fornecedor nao cria linha nova.
await indicar(petA, "Atacadão Pet Sul", null, "ração e areia", "ração");
const depois = Number((await db.query(`SELECT count(*)::int c FROM supplier_leads`)).rows[0].c);
ok(depois === 4, "reindicar o mesmo fornecedor nao duplica");
const atualizado = (
  await db.query(`SELECT products FROM supplier_leads WHERE company_id=$1 AND supplier_key=$2`, [
    petA,
    chave("Atacadão Pet Sul"),
  ])
).rows[0];
ok(atualizado.products === "ração e areia", "reindicar atualiza o que ele compra");

console.log("\n--- cidade herdada da empresa ---");
const semCidade = (
  await db.query(`SELECT city,uf FROM supplier_leads WHERE company_id=$1 AND supplier_key=$2`, [
    petB,
    chave("atacadao pet sul"),
  ])
).rows[0];
ok(
  semCidade.city === "Uberlandia" && semCidade.uf === "MG",
  "sem cidade informada, cai para a cidade do comerciante",
);

console.log("\n--- agregacao do back office ---");
const agregado = (
  await db.query(
    `SELECT l.supplier_key,
            max(l.supplier_name) supplier_name,
            count(DISTINCT l.company_id)::int merchants,
            array_remove(array_agg(DISTINCT nullif(concat_ws(' — ', l.city, l.uf), '')), NULL) cities,
            array_remove(array_agg(DISTINCT l.search_term), NULL) searches,
            EXISTS (
              SELECT 1 FROM companies c
               WHERE c.account_type='fornecedor'
                 AND lower(c.name) LIKE '%' || l.supplier_key || '%'
            ) already_on_platform
       FROM supplier_leads l
      GROUP BY l.supplier_key
      ORDER BY count(DISTINCT l.company_id) DESC`,
  )
).rows;

ok(agregado.length === 2, `2 fornecedores distintos apos agrupar — veio ${agregado.length}`);
ok(
  agregado[0].supplier_key === "atacadao pet sul" && agregado[0].merchants === 3,
  `o mais citado vem primeiro, com 3 comerciantes — veio ${agregado[0].merchants}`,
);
ok(
  agregado[0].cities.some((c) => c.includes("Uberlandia")) &&
    agregado[0].cities.some((c) => c.includes("Araguari")),
  "as duas cidades aparecem agrupadas",
);
ok(agregado[0].searches.length >= 2, `buscas registradas: ${agregado[0].searches.join(", ")}`);
ok(
  agregado[0].already_on_platform === false,
  "fornecedor que nao esta na Central aparece como 'ligar'",
);

console.log("\n--- fornecedor que ja se cadastrou sai da lista de ligar ---");
await criarEmpresa("Atacadao Pet Sul Distribuidora", "fornecedor", "Curitiba", "PR");
const revisado = (
  await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM companies c
        WHERE c.account_type='fornecedor'
          AND lower(c.name) LIKE '%' || $1 || '%') ja`,
    [chave("Atacadão Pet Sul")],
  )
).rows[0];
ok(revisado.ja === true, "depois de cadastrado, ele deixa de aparecer como pendente");

console.log("\n--- isolamento ---");
const daEmpresaA = Number(
  (await db.query(`SELECT count(*)::int c FROM supplier_leads WHERE company_id=$1`, [petA])).rows[0]
    .c,
);
ok(daEmpresaA === 2, "cada indicacao fica amarrada a empresa que a fez");

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
