// Testa a regra única de acesso.
//
//   node scripts/acesso.test.mjs
//
// Errar para um lado deixa cliente pagante sem entrar. Errar para o outro dá
// o produto de graça. É a função mais barata de testar e a mais cara de
// quebrar em silêncio.
import process from "node:process";

const { hasActiveAccess } = await import("../src/lib/access.ts");

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const ontem = new Date(Date.now() - 10 * 864e5).toISOString();
const amanha = new Date(Date.now() + 10 * 864e5).toISOString();

const conta = (extra) => ({
  subscriptionStatus: "canceled",
  trialEndsAt: ontem,
  currentPeriodEnd: null,
  ...extra,
});

console.log("--- o fornecedor não paga ---");
ok(
  hasActiveAccess(conta({ accountType: "fornecedor" })) === true,
  "fornecedor com trial vencido e assinatura cancelada entra assim mesmo",
);
ok(
  hasActiveAccess(conta({ accountType: "fornecedor", subscriptionStatus: "past_due" })) === true,
  "fornecedor em atraso entra: não existe cobrança para ele atrasar",
);

console.log("\n--- mas suspensão administrativa vence tudo ---");
// Sem isto, um fornecedor que precisou ser bloqueado por abuso continuaria
// dentro, porque a regra do fornecedor está antes das outras.
ok(
  hasActiveAccess(conta({ accountType: "fornecedor", suspended: true })) === false,
  "fornecedor suspenso pelo back office não entra",
);

console.log("\n--- o comerciante continua pagando ---");
ok(
  hasActiveAccess(conta({ accountType: "comerciante" })) === false,
  "comerciante com trial vencido e assinatura cancelada NÃO entra",
);
ok(
  hasActiveAccess(conta({ accountType: "comerciante", subscriptionStatus: "active" })) === true,
  "comerciante com assinatura ativa entra",
);
ok(
  hasActiveAccess(
    conta({ accountType: "comerciante", subscriptionStatus: "trialing", trialEndsAt: amanha }),
  ) === true,
  "comerciante dentro do teste de 7 dias entra",
);
ok(
  hasActiveAccess(
    conta({
      accountType: "comerciante",
      subscriptionStatus: "canceled",
      currentPeriodEnd: amanha,
    }),
  ) === true,
  "quem cancelou mas já pagou o mês continua até o fim do período",
);

console.log("\n--- conta sem tipo declarado é tratada como pagante ---");
// Não é detalhe: se um caminho esquecer de passar o accountType, a falha tem
// que ser barrar quem deveria entrar — e não liberar quem deveria pagar.
ok(hasActiveAccess(conta({})) === false, "sem accountType, a regra do fornecedor não se aplica");

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
