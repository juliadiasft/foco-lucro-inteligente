// Testa o fim do teste (X05).
//
//   node scripts/fim-do-teste.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { diasRestantes, naRetaFinal, tituloDoFim, vezesAMensalidade } =
  await import("../src/lib/fim-do-teste.ts");

const agora = new Date("2026-09-18T12:00:00Z");
ok(diasRestantes("2026-09-20T12:00:00Z", agora) === 2, "faltam 2 dias");
ok(
  diasRestantes("2026-09-19T00:00:00Z", agora) === 1,
  "12h restantes = 1 dia (arredonda para cima)",
);
ok(diasRestantes("2026-09-17T12:00:00Z", agora) === 0, "já passou = 0");

ok(naRetaFinal("trialing", 3) && naRetaFinal("trialing", 1), "avisa com 3 e 1 dia");
ok(!naRetaFinal("trialing", 4), "com 4 dias ainda não");
ok(!naRetaFinal("trialing", 0), "vencido não é 'reta final': é bloqueio");
ok(!naRetaFinal("active", 2), "quem já assina nunca vê");

ok(tituloDoFim(2) === "Seu teste acaba em 2 dias", "título no plural");
ok(tituloDoFim(1) === "Seu teste acaba amanhã", "título de 1 dia");

ok(
  vezesAMensalidade(1108, 129.9) === "8,5× a mensalidade",
  `8,5× (${vezesAMensalidade(1108, 129.9)})`,
);
ok(vezesAMensalidade(100, 129.9) === null, "abaixo da mensalidade não vira argumento");
ok(vezesAMensalidade(0, 129.9) === null, "zero recuperado = nada a dizer");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
