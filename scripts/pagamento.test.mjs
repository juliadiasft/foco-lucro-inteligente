// Confere o que o servidor gravou depois da sequencia de webhooks da Cakto.
//
// Rode com o servidor PARADO: o PGlite e de escrita unica e abrir o banco com
// o servidor de pe arrisca o arquivo.
//
//   node scripts/pagamento.test.mjs
//
// A sequencia de eventos que este teste espera ter acontecido antes:
//   subscription_created (premium) -> repetido -> evento desconhecido ->
//   pagamento de cliente inexistente -> subscription_renewed (essencial) ->
//   subscription_canceled -> refund
//
// Este e o unico caminho do sistema onde uma falha significa dinheiro
// entrando sem o cliente receber acesso.
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const EMAIL = "comerciante.demo@teste.local";
const SEGREDO = "segredo-de-teste-local-nao-e-o-de-producao";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const db = await PGlite.create(path.resolve(".local-data/central-comerciante"));
const uma = async (sql, params) => (await db.query(sql, params)).rows[0];
const todas = async (sql, params) => (await db.query(sql, params)).rows;

const empresa = await uma(
  `SELECT c.id, c.name, c.plan, c.subscription_status
     FROM companies c JOIN users u ON u.company_id=c.id AND u.role='owner'
    WHERE lower(u.email)=$1`,
  [EMAIL],
);
if (!empresa) {
  console.error(`Nao achei a empresa de ${EMAIL}. Rode a sequencia de webhooks antes.`);
  process.exit(1);
}
console.log(`Empresa: ${empresa.name}`);
console.log(`Estado final: plano ${empresa.plan}, status ${empresa.subscription_status}\n`);

const assinatura = await uma(
  `SELECT subscription_id, customer_id, plan, status, current_period_end, cancel_at_period_end
     FROM subscriptions WHERE company_id=$1`,
  [empresa.id],
);

console.log("--- o pagamento chegou e foi gravado ---");
ok(assinatura?.subscription_id === "sub_teste_0001", "subscription_id da Cakto gravado");
ok(assinatura?.customer_id === "cus_teste_0001", "customer_id da Cakto gravado");
ok(assinatura?.current_period_end !== null, "fim do periodo pago gravado");

console.log("\n--- nao duplicou ---");
const quantas = await uma(`SELECT count(*)::int c FROM subscriptions WHERE company_id=$1`, [
  empresa.id,
]);
ok(quantas.c === 1, `uma assinatura so (veio ${quantas.c})`);

console.log("\n--- a troca de oferta trocou o plano ---");
ok(
  empresa.plan === "essencial",
  `renovacao na oferta do essencial deixou o plano 'essencial' (veio '${empresa.plan}')`,
);

console.log("\n--- estorno nao deixa a conta ativa ---");
ok(
  empresa.subscription_status !== "active",
  `status apos estorno nao e 'active' (ficou '${empresa.subscription_status}')`,
);

console.log("\n--- quem pagou nao perde o que comprou ---");
if (assinatura?.current_period_end) {
  const fim = new Date(assinatura.current_period_end);
  console.log(`      periodo pago vai ate ${fim.toISOString().slice(0, 10)}`);
}

console.log("\n--- pagamento sem empresa correspondente foi registrado ---");
const pendentes = await todas(
  `SELECT event_type, reason, customer_email, subscription_id
     FROM billing_webhook_failures WHERE resolved_at IS NULL
    ORDER BY created_at DESC LIMIT 5`,
);
const fantasma = pendentes.find((linha) => linha.subscription_id === "sub_fantasma");
ok(
  Boolean(fantasma),
  fantasma
    ? `o pagamento fantasma virou pendencia (motivo: ${fantasma.reason})`
    : `NAO foi registrado — um pagamento assim sumiria sem rastro (${pendentes.length} pendencia(s) no total)`,
);
for (const linha of pendentes) {
  console.log(
    `      ${linha.event_type} · ${linha.reason} · ${linha.customer_email || "sem email"}`,
  );
}

console.log("\n--- o segredo nao vazou para o diagnostico ---");
const gravados = await todas(`SELECT payload::text AS payload FROM billing_webhook_failures`);
ok(
  !gravados.some((linha) => linha.payload.includes(SEGREDO)),
  `o segredo do webhook nao aparece em nenhum dos ${gravados.length} diagnostico(s)`,
);

console.log("\n--- documento e cartao tambem nao ---");
ok(
  !gravados.some((linha) =>
    /"(cpf|cnpj|card|card_number)"\s*:\s*"(?!\[removido\])/i.test(linha.payload),
  ),
  "documento e cartao aparecem como [removido] quando presentes",
);

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
