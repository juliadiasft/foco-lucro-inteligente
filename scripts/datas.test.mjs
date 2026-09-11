// Testa como as datas aparecem na tela.
//
//   node scripts/datas.test.mjs
//
// Existe por causa de um defeito que ficou no ar sem ninguém notar: o
// vencimento no financeiro aparecia um dia antes. Uma conta que vencia dia 15
// aparecia vencendo dia 14 — o tipo de erro que o comerciante não reporta,
// porque ele só acha que se confundiu, e aí para de confiar na tela.
//
// A causa era ler "2026-09-15" como instante (meia-noite em Londres) e mostrar
// no horário de Brasília, três horas atrás. O teste roda forçado no fuso de
// São Paulo, porque é nele que o erro aparece — num servidor em UTC ele passa
// e esconde o problema.
import process from "node:process";

process.env.TZ = "America/Sao_Paulo";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { dataBR } = await import("../src/lib/format.ts");

console.log("--- data sem hora é o dia do calendário, e não um instante ---");
ok(
  dataBR("2026-09-15") === "15/09/2026",
  `vencimento dia 15 aparece dia 15 (${dataBR("2026-09-15")})`,
);
ok(
  dataBR("2015-03-10") === "10/03/2015",
  `abertura em 10/03 aparece 10/03 (${dataBR("2015-03-10")})`,
);
ok(
  dataBR("2026-01-01") === "01/01/2026",
  `virada de ano não volta para 2025 (${dataBR("2026-01-01")})`,
);

console.log("\n--- instante com hora continua virando horário de Brasília ---");
// Um cadastro feito às 23h de Brasília do dia 10 é 02h de Londres do dia 11.
// Para quem está no Brasil, ele aconteceu no dia 10 — e isso não pode mudar.
ok(
  dataBR("2026-09-11T02:00:00.000Z") === "10/09/2026",
  `23h de Brasília do dia 10 continua dia 10 (${dataBR("2026-09-11T02:00:00.000Z")})`,
);
ok(
  dataBR(new Date("2026-09-11T15:00:00.000Z")) === "11/09/2026",
  "um Date do meio da tarde continua funcionando",
);

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
