// Testa o caminho do dinheiro: o webhook da Cakto chegando e virando acesso.
//
//   node scripts/pagamento.test.mjs
//
// Este e o unico caminho do sistema onde uma falha significa dinheiro entrando
// sem o cliente receber acesso.
//
// A versao anterior deste arquivo nao montava nada: ela abria o banco local e
// conferia o que tivesse sobrado de uma sequencia de webhooks disparada a mao
// antes, em outro momento. Quando o demo-seed reescrevia aquele estado — o que
// ele faz de proposito — o teste acusava duas falhas que nao existiam no
// codigo. Teste que grita sem motivo e pior que teste nenhum, porque no dia em
// que ele gritar por um motivo de verdade ninguem vai acreditar.
//
// Agora ele monta o proprio cenario num banco descartavel, dispara a sequencia
// inteira contra o handleCaktoWebhook de verdade — o mesmo que a rota chama em
// producao — e confere o resultado.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const SEGREDO = "segredo-de-teste-local-nao-e-o-de-producao";
const EMAIL = "comerciante.pagamento@teste.local";

// Precisa estar no ambiente antes de o modulo do banco ser carregado.
const bancoTemporario = mkdtempSync(path.join(tmpdir(), "pagamento-"));
process.env.LOCAL_DB_DIR = bancoTemporario;
delete process.env.DATABASE_URL;
process.env.CAKTO_WEBHOOK_SECRET = SEGREDO;
// As ofertas que o teste usa. O handleCaktoWebhook descobre plano e ciclo a
// partir do ultimo pedaco destes enderecos.
process.env.CAKTO_CHECKOUT_ESSENCIAL = "https://pay.cakto.com.br/ofertaessencial";
process.env.CAKTO_CHECKOUT_PROFISSIONAL = "https://pay.cakto.com.br/ofertaprofissional";
process.env.CAKTO_CHECKOUT_PREMIUM = "https://pay.cakto.com.br/ofertapremium";
process.env.CAKTO_CHECKOUT_PREMIUM_ANUAL = "https://pay.cakto.com.br/ofertapremiumanual";

const { carregarModulo, fecharCarregador } = await import("./lib/carregar-ts.mjs");

try {
  const { handleCaktoWebhook } = await carregarModulo("/src/lib/server/billing.server.ts");
  const { query } = await carregarModulo("/src/lib/server/db.server.ts");

  const uma = async (sql, params) => (await query(sql, params)).rows[0];

  // O db.server aplica as migracoes sozinho na primeira consulta.
  const empresaId = (
    await query(
      `INSERT INTO companies (name,account_type,plan,subscription_status)
       VALUES ('Mercadinho do Teste','comerciante','essencial','trialing') RETURNING id`,
    )
  ).rows[0].id;
  await query(
    `INSERT INTO users (company_id,name,email,password_hash,role)
     VALUES ($1,'Dono',$2,'hash-irrelevante','owner')`,
    [empresaId, EMAIL],
  );
  // O cadastro real cria a assinatura em teste junto com a empresa, e e por
  // ela que o webhook reconhece de quem e o pagamento. Sem esta linha o
  // cenario nao representa nenhum cliente de verdade — e o handler responde
  // "empresa_nao_identificada", corretamente.
  await query(
    `INSERT INTO subscriptions (company_id,plan,status) VALUES ($1,'essencial','trialing')`,
    [empresaId],
  );

  const enviar = (corpo) =>
    handleCaktoWebhook(
      new Request("https://teste.local/api/cakto-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      }),
    );

  const evento = (event, data) => ({ secret: SEGREDO, event, data });
  const cliente = { id: "cus_teste_0001", email: EMAIL, cpf: "12345678901" };

  console.log("--- o que o servidor recusa antes de olhar o conteudo ---");
  ok(
    (
      await handleCaktoWebhook(
        new Request("https://teste.local/api/cakto-webhook", {
          method: "POST",
          body: JSON.stringify({ secret: "errado", event: "subscription_created", data: {} }),
        }),
      )
    ).status === 401,
    "segredo errado devolve 401",
  );
  ok(
    (
      await handleCaktoWebhook(
        new Request("https://teste.local/api/cakto-webhook", {
          method: "POST",
          body: "isto nao e json",
        }),
      )
    ).status === 400,
    "corpo que nao e JSON devolve 400",
  );

  console.log("\n--- a assinatura nasce ---");
  const criada = await enviar(
    evento("subscription_created", {
      id: "sub_teste_0001",
      subscription: { id: "sub_teste_0001" },
      offer: { id: "ofertapremium" },
      customer: cliente,
      next_payment_date: "2027-01-15",
    }),
  );
  ok(criada.status === 200, `subscription_created respondeu ${criada.status}`);

  let assinatura = await uma(
    `SELECT subscription_id, customer_id, plan, status, current_period_end, billing_cycle
       FROM subscriptions WHERE company_id=$1`,
    [empresaId],
  );
  let empresa = await uma(`SELECT plan, subscription_status FROM companies WHERE id=$1`, [
    empresaId,
  ]);
  ok(assinatura?.subscription_id === "sub_teste_0001", "subscription_id da Cakto gravado");
  ok(assinatura?.customer_id === "cus_teste_0001", "customer_id da Cakto gravado");
  ok(assinatura?.current_period_end !== null, "fim do periodo pago gravado");
  ok(empresa?.plan === "premium", `a oferta premium virou plano premium (veio '${empresa?.plan}')`);

  console.log("\n--- o mesmo evento duas vezes nao duplica ---");
  await enviar(
    evento("subscription_created", {
      id: "sub_teste_0001",
      subscription: { id: "sub_teste_0001" },
      offer: { id: "ofertapremium" },
      customer: cliente,
      next_payment_date: "2027-01-15",
    }),
  );
  const quantas = await uma(`SELECT count(*)::int c FROM subscriptions WHERE company_id=$1`, [
    empresaId,
  ]);
  ok(quantas.c === 1, `uma assinatura so (veio ${quantas.c})`);

  console.log("\n--- a troca de oferta troca o plano ---");
  await enviar(
    evento("subscription_renewed", {
      id: "sub_teste_0001",
      subscription: { id: "sub_teste_0001" },
      offer: { id: "ofertaessencial" },
      customer: cliente,
      next_payment_date: "2027-02-15",
    }),
  );
  empresa = await uma(`SELECT plan, subscription_status FROM companies WHERE id=$1`, [empresaId]);
  ok(
    empresa?.plan === "essencial",
    `renovacao na oferta do essencial deixou o plano 'essencial' (veio '${empresa?.plan}')`,
  );

  console.log("\n--- quem paga o ano recebe o ano ---");
  // Empresa nova de proposito: o prazo padrao de 365 dias so vale quando ainda
  // nao existe um fim de periodo gravado. Testar isso na empresa anterior
  // mediria outra coisa.
  const anualId = (
    await query(
      `INSERT INTO companies (name,account_type,plan,subscription_status)
       VALUES ('Padaria Anual','comerciante','essencial','trialing') RETURNING id`,
    )
  ).rows[0].id;
  await query(
    `INSERT INTO users (company_id,name,email,password_hash,role)
     VALUES ($1,'Dona','anual@teste.local','hash-irrelevante','owner')`,
    [anualId],
  );
  await query(
    `INSERT INTO subscriptions (company_id,plan,status) VALUES ($1,'essencial','trialing')`,
    [anualId],
  );
  await enviar(
    evento("subscription_created", {
      id: "sub_anual_0001",
      subscription: { id: "sub_anual_0001" },
      offer: { id: "ofertapremiumanual" },
      customer: { id: "cus_anual", email: "anual@teste.local" },
      // Sem next_payment_date: e aqui que o prazo padrao decide.
    }),
  );
  const anual = await uma(
    `SELECT billing_cycle, current_period_end FROM subscriptions WHERE company_id=$1`,
    [anualId],
  );
  const diasRestantes = Math.round((new Date(anual.current_period_end) - Date.now()) / 86_400_000);
  ok(anual.billing_cycle === "anual", "o ciclo anual foi reconhecido pela oferta");
  ok(diasRestantes >= 360, `sem data da Cakto, o anual deu ${diasRestantes} dias (e nao 30)`);

  console.log("\n--- renovacao sem data estende, em vez de manter o prazo velho ---");
  // Este era o furo: a renovacao sem data reaproveitava o fim de periodo ja
  // gravado, entao quem pagava mais um ano continuava vencendo na data velha.
  // Dinheiro entrando sem o cliente receber o que comprou.
  await enviar(
    evento("subscription_renewed", {
      id: "sub_teste_0001",
      subscription: { id: "sub_teste_0001" },
      offer: { id: "ofertapremiumanual" },
      customer: cliente,
    }),
  );
  const renovado = await uma(`SELECT current_period_end FROM subscriptions WHERE company_id=$1`, [
    empresaId,
  ]);
  const diasAposRenovar = Math.round(
    (new Date(renovado.current_period_end) - Date.now()) / 86_400_000,
  );
  ok(
    diasAposRenovar >= 360,
    `renovacao anual sem data deu ${diasAposRenovar} dias contados de hoje`,
  );

  console.log("\n--- e nunca encurta o que o cliente ja tinha ---");
  // Cliente com prazo longo la na frente renova no mensal: o prazo maior tem
  // que sobreviver. Encurtar seria tirar acesso de quem ja pagou por ele.
  const bemLonge = new Date(Date.now() + 800 * 86_400_000);
  await query(`UPDATE subscriptions SET current_period_end=$2 WHERE company_id=$1`, [
    empresaId,
    bemLonge,
  ]);
  await enviar(
    evento("subscription_renewed", {
      id: "sub_teste_0001",
      subscription: { id: "sub_teste_0001" },
      offer: { id: "ofertaessencial" },
      customer: cliente,
    }),
  );
  const preservado = await uma(`SELECT current_period_end FROM subscriptions WHERE company_id=$1`, [
    empresaId,
  ]);
  const diasPreservados = Math.round(
    (new Date(preservado.current_period_end) - Date.now()) / 86_400_000,
  );
  ok(
    diasPreservados >= 790,
    `prazo de ${diasPreservados} dias sobreviveu a uma renovacao mensal sem data`,
  );

  console.log("\n--- estorno nao deixa a conta ativa ---");
  await enviar(
    evento("refund", {
      id: "sub_teste_0001",
      subscription: { id: "sub_teste_0001" },
      customer: cliente,
    }),
  );
  empresa = await uma(`SELECT subscription_status FROM companies WHERE id=$1`, [empresaId]);
  ok(
    empresa?.subscription_status !== "active",
    `status apos estorno nao e 'active' (ficou '${empresa?.subscription_status}')`,
  );

  console.log("\n--- pagamento de quem nao existe vira pendencia, e nao silencio ---");
  await enviar(
    evento("subscription_created", {
      id: "sub_fantasma",
      subscription: { id: "sub_fantasma" },
      offer: { id: "ofertapremium" },
      customer: { id: "cus_fantasma", email: "ninguem@teste.local", cnpj: "12345678000199" },
    }),
  );
  const pendentes = (
    await query(
      `SELECT event_type, reason, customer_email, subscription_id, payload::text AS payload
         FROM billing_webhook_failures WHERE resolved_at IS NULL ORDER BY created_at DESC`,
    )
  ).rows;
  const fantasma = pendentes.find((linha) => linha.subscription_id === "sub_fantasma");
  ok(
    Boolean(fantasma),
    fantasma
      ? `o pagamento fantasma virou pendencia (motivo: ${fantasma.reason})`
      : "NAO foi registrado — um pagamento assim sumiria sem rastro",
  );

  console.log("\n--- o diagnostico nao guarda segredo nem documento ---");
  const gravados = (await query(`SELECT payload::text AS payload FROM billing_webhook_failures`))
    .rows;
  ok(
    !gravados.some((linha) => linha.payload.includes(SEGREDO)),
    `o segredo do webhook nao aparece em nenhum dos ${gravados.length} diagnostico(s)`,
  );
  ok(
    !gravados.some((linha) =>
      /"(cpf|cnpj|card|card_number)"\s*:\s*"(?!\[removido\])/i.test(linha.payload),
    ),
    "documento e cartao aparecem como [removido] quando presentes",
  );
} finally {
  await fecharCarregador();
  rmSync(bancoTemporario, { recursive: true, force: true });
}

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
