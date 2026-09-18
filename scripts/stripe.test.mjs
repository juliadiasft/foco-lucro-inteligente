// Testa o caminho do dinheiro pela Stripe: o webhook assinado virando acesso.
//
//   node scripts/stripe.test.mjs
//
// Monta o proprio cenario num banco descartavel e dispara eventos assinados
// contra o handleStripeWebhook de verdade — o mesmo que a rota chama.
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const SEGREDO = "whsec_segredo_de_teste_local";
const bancoTemporario = mkdtempSync(path.join(tmpdir(), "stripe-"));
process.env.LOCAL_DB_DIR = bancoTemporario;
delete process.env.DATABASE_URL;
process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;

const { carregarModulo, fecharCarregador } = await import("./lib/carregar-ts.mjs");

try {
  const { handleStripeWebhook } = await carregarModulo("/src/lib/server/stripe-webhook.server.ts");
  const stripe = await carregarModulo("/src/lib/server/stripe.server.ts");
  const { query } = await carregarModulo("/src/lib/server/db.server.ts");
  const uma = async (sql, params) => (await query(sql, params)).rows[0];

  const empresaId = (
    await query(
      `INSERT INTO companies (name,account_type,plan,subscription_status)
       VALUES ('Pet do Teste','comerciante','essencial','trialing') RETURNING id`,
    )
  ).rows[0].id;
  await query(
    `INSERT INTO users (company_id,name,email,password_hash,role)
     VALUES ($1,'Dono','dono.stripe@teste.local','x','owner')`,
    [empresaId],
  );
  await query(`INSERT INTO subscriptions (company_id,plan,status) VALUES ($1,'essencial','trialing')`, [
    empresaId,
  ]);

  const assinar = (corpo, segredo = SEGREDO, t = Math.floor(Date.now() / 1000)) => {
    const v1 = createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
    return `t=${t},v1=${v1}`;
  };
  let n = 0;
  const enviar = (type, object, opcoes = {}) => {
    const corpo = JSON.stringify({ id: opcoes.id ?? `evt_${++n}`, type, data: { object } });
    return handleStripeWebhook(
      new Request("https://teste.local/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": opcoes.assinatura ?? assinar(corpo) },
        body: corpo,
      }),
    );
  };
  const lerAssinatura = () =>
    uma(
      `SELECT provider,subscription_id,customer_id,plan,status,billing_cycle,currency,
              current_period_end,cancel_at_period_end FROM subscriptions WHERE company_id=$1`,
      [empresaId],
    );
  const lerEmpresa = () => uma(`SELECT plan,subscription_status FROM companies WHERE id=$1`, [empresaId]);

  const meta = { company_id: empresaId, plan: "profissional", cycle: "mensal" };
  const fim = Math.floor(Date.now() / 1000) + 30 * 86400;
  const sub = (extra = {}) => ({
    id: "sub_teste_1",
    customer: "cus_teste_1",
    status: "active",
    cancel_at_period_end: false,
    metadata: meta,
    current_period_end: fim,
    items: { data: [{ price: { id: "price_1", currency: "brl", lookup_key: "central_profissional_mensal_brl_12990" } }] },
    ...extra,
  });

  console.log("--- o que o servidor recusa ---");
  const corpoRuim = JSON.stringify({ id: "evt_x", type: "customer.subscription.created", data: { object: sub() } });
  const semAssinatura = await handleStripeWebhook(
    new Request("https://teste.local/x", { method: "POST", body: corpoRuim }),
  );
  ok(semAssinatura.status === 401, "sem cabecalho de assinatura devolve 401");
  ok((await enviar("customer.subscription.created", sub(), { assinatura: assinar(corpoRuim, "outro") })).status === 401, "assinatura de outro segredo devolve 401");
  ok(
    !stripe.verifyStripeSignature("{}", assinar("{}", SEGREDO, 1000), SEGREDO),
    "assinatura velha (fora da tolerancia) e recusada",
  );
  ok((await lerAssinatura()).status === "trialing", "nada mudou no banco depois das recusas");

  console.log("\n--- o pagamento fecha e a assinatura nasce ---");
  const sessao = await enviar("checkout.session.completed", {
    mode: "subscription",
    payment_status: "paid",
    customer: "cus_teste_1",
    subscription: "sub_teste_1",
    client_reference_id: empresaId,
    currency: "brl",
    metadata: meta,
  });
  ok(sessao.status === 200, `checkout.session.completed respondeu ${sessao.status}`);
  let a = await lerAssinatura();
  ok(a.provider === "stripe", "provider vira 'stripe'");
  ok(a.subscription_id === "sub_teste_1" && a.customer_id === "cus_teste_1", "ids da Stripe gravados");
  ok(a.status === "active" && (await lerEmpresa()).plan === "profissional", "plano profissional ativo");
  ok(a.current_period_end !== null, "ja tem fim de periodo antes do evento da assinatura chegar");

  await enviar("customer.subscription.updated", sub());
  a = await lerAssinatura();
  ok(Math.abs(new Date(a.current_period_end).getTime() / 1000 - fim) < 2, "fim do periodo exato vem do evento da assinatura");
  ok(a.currency === "BRL", "moeda gravada");

  console.log("\n--- o mesmo evento duas vezes nao duplica ---");
  const corpoDup = JSON.stringify({ id: "evt_dup", type: "customer.subscription.updated", data: { object: sub() } });
  const req = () =>
    handleStripeWebhook(new Request("https://teste.local/x", { method: "POST", headers: { "stripe-signature": assinar(corpoDup) }, body: corpoDup }));
  await req();
  await req();
  ok(
    (await uma(`SELECT count(*)::int c FROM billing_webhook_events WHERE event_key='evt_dup'`)).c === 1,
    "evento repetido gravado uma vez so",
  );

  console.log("\n--- troca de plano e de ciclo ---");
  await enviar(
    "customer.subscription.updated",
    sub({
      metadata: { ...meta, plan: "premium", cycle: "anual" },
      items: { data: [{ price: { id: "price_2", currency: "brl", lookup_key: "central_premium_anual_brl_194292" } }] },
    }),
  );
  a = await lerAssinatura();
  ok((await lerEmpresa()).plan === "premium" && a.billing_cycle === "anual", "subiu para premium anual");

  console.log("\n--- pagamento recusado e recuperado ---");
  await enviar("invoice.payment_failed", { subscription: "sub_teste_1" });
  ok((await lerAssinatura()).status === "past_due", "fatura recusada vira 'past_due'");
  ok((await lerAssinatura()).plan === "premium", "plano nao muda por causa da fatura");
  await enviar("customer.subscription.updated", sub({ metadata: { ...meta, plan: "premium", cycle: "anual" } }));
  ok((await lerAssinatura()).status === "active", "quando a Stripe volta a 'active', o acesso volta");

  console.log("\n--- cancelamento ---");
  await enviar("customer.subscription.updated", sub({ cancel_at_period_end: true }));
  a = await lerAssinatura();
  ok(a.status === "canceled" && a.cancel_at_period_end === true, "cancelar no fim do periodo marca 'canceled'");
  ok(new Date(a.current_period_end).getTime() > Date.now(), "o acesso pago continua ate o fim do periodo");
  await enviar("invoice.payment_failed", { subscription: "sub_teste_1" });
  ok((await lerAssinatura()).cancel_at_period_end === true, "fatura atrasada nao desfaz o cancelamento");
  await enviar("customer.subscription.deleted", sub({ status: "canceled", ended_at: Math.floor(Date.now() / 1000) }));
  ok((await lerEmpresa()).subscription_status === "canceled", "assinatura encerrada");

  console.log("\n--- o que nao consegue ser conciliado vira pendencia ---");
  await enviar("customer.subscription.created", sub({ id: "sub_fantasma", customer: "cus_x", metadata: {} }));
  const pend = await uma(`SELECT reason FROM billing_webhook_failures WHERE provider='stripe' AND reason='empresa_nao_identificada'`);
  ok(Boolean(pend), "evento de empresa desconhecida foi registrado para conciliacao");

  console.log("\n--- precos ---");
  ok(stripe.stripeAmountCents("profissional", "mensal", "BRL") === 12990, "profissional mensal = 12990 centavos");
  ok(stripe.stripeAmountCents("premium", "anual", "BRL") === 194292, "premium anual = 194292 centavos (10% off)");
  let recusou = false;
  try {
    stripe.stripeAmountCents("premium", "mensal", "USD");
  } catch {
    recusou = true;
  }
  ok(recusou, "moeda sem preco definido nao e oferecida");
} finally {
  await fecharCarregador();
  rmSync(bancoTemporario, { recursive: true, force: true });
}

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
