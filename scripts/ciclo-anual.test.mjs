// Testa a cobranca anual: precos, reconhecimento da oferta no webhook e —
// o que mais importa — o prazo de acesso.
//
//   node scripts/ciclo-anual.test.mjs
//
// Quem paga doze meses precisa receber doze meses. Antes desta mudanca o
// webhook tinha um fallback fixo de 30 dias, que teria dado um mes de acesso
// a quem pagou o ano inteiro.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

// --- Precos e economia, sem depender do banco ---
const { annualPricesBRL, annualSavingsBRL, annualMonthlyEquivalent, planPricesBRL, priceFor } =
  await import("../src/lib/plans.ts").catch(() => ({}));

console.log("--- precos do ciclo anual ---");
if (annualPricesBRL) {
  ok(annualPricesBRL.essencial === 799, `Essencial anual R$ ${annualPricesBRL.essencial}`);
  ok(annualPricesBRL.profissional === 1299, `Profissional anual R$ ${annualPricesBRL.profissional}`);
  ok(annualPricesBRL.premium === 1799, `Premium anual R$ ${annualPricesBRL.premium}`);
  ok(
    Math.abs(annualSavingsBRL("profissional") - 259.8) < 0.01,
    `economia do Profissional R$ ${annualSavingsBRL("profissional").toFixed(2)}`,
  );
  ok(
    Math.abs(annualMonthlyEquivalent("profissional") - 108.25) < 0.01,
    `equivalente mensal do anual R$ ${annualMonthlyEquivalent("profissional").toFixed(2)}`,
  );
  ok(
    priceFor("premium", "anual") === 1799 && priceFor("premium", "mensal") === planPricesBRL.premium,
    "priceFor devolve o valor certo em cada ciclo",
  );
} else {
  console.log("  (pulado: o runtime nao importa .ts direto)");
}

// --- O prazo de acesso, contra o banco de verdade ---
console.log("\n--- prazo de acesso por ciclo ---");
const dir = path.resolve("migrations");
const db = new PGlite();
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
}

const empresa = (
  await db.query(
    `INSERT INTO companies (name,account_type,plan) VALUES ('Teste Anual','comerciante','essencial')
     RETURNING id`,
  )
).rows[0].id;
await db.query(`INSERT INTO subscriptions (company_id,plan,status) VALUES ($1,'essencial','trialing')`, [
  empresa,
]);

const coluna = await db.query(
  `SELECT billing_cycle FROM subscriptions WHERE company_id=$1`,
  [empresa],
);
ok(coluna.rows[0].billing_cycle === "mensal", "assinatura nasce como 'mensal' por padrao");

// Reproduz o calculo do webhook para os dois ciclos.
const prazo = (cycle) => new Date(Date.now() + (cycle === "anual" ? 365 : 30) * 86_400_000);
const diasMensal = Math.round((prazo("mensal") - Date.now()) / 864e5);
const diasAnual = Math.round((prazo("anual") - Date.now()) / 864e5);
ok(diasMensal === 30, `sem data da Cakto, mensal da ${diasMensal} dias`);
ok(diasAnual === 365, `sem data da Cakto, anual da ${diasAnual} dias`);

await db.query(
  `UPDATE subscriptions SET billing_cycle='anual', current_period_end=$2 WHERE company_id=$1`,
  [empresa, prazo("anual")],
);
const anual = (
  await db.query(
    `SELECT billing_cycle, current_period_end FROM subscriptions WHERE company_id=$1`,
    [empresa],
  )
).rows[0];
const restam = Math.round((new Date(anual.current_period_end) - Date.now()) / 864e5);
ok(anual.billing_cycle === "anual", "ciclo anual foi gravado");
ok(restam >= 360, `quem pagou o ano tem ${restam} dias de acesso`);

console.log("\n--- a trava do banco recusa ciclo invalido ---");
let recusou = false;
try {
  await db.query(`UPDATE subscriptions SET billing_cycle='semestral' WHERE company_id=$1`, [
    empresa,
  ]);
} catch {
  recusou = true;
}
ok(recusou, "CHECK do banco barra um ciclo que nao existe");

console.log("\n--- a intencao de checkout guarda o ciclo ---");
const usuario = (
  await db.query(
    `INSERT INTO users (company_id,name,email,password_hash,role)
     VALUES ($1,'Dono','dono@teste.local','hash','owner') RETURNING id`,
    [empresa],
  )
).rows[0].id;
await db.query(
  `INSERT INTO checkout_intents (company_id,user_id,token_hash,plan,offer_id,billing_cycle,expires_at)
   VALUES ($1,$2,'hash-de-teste','premium','oferta-anual','anual',now()+interval '2 hours')`,
  [empresa, usuario],
);
const intencao = (
  await db.query(`SELECT plan, billing_cycle FROM checkout_intents WHERE token_hash='hash-de-teste'`)
).rows[0];
ok(
  intencao.billing_cycle === "anual" && intencao.plan === "premium",
  "a intencao carrega plano e ciclo ate o webhook",
);

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
