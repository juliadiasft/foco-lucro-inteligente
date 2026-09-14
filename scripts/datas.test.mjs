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

console.log("\n--- 'hoje' é o de Brasília, mesmo num servidor em UTC ---");
// O servidor do Render e o banco rodam em UTC. Às 23h30 de Brasília do dia 14
// eles já estão no dia 15 — e uma conta que vence dia 14 não pode aparecer
// vencida. O relógio do processo é trocado para UTC só aqui, para simular o
// servidor; a função tem de dar o mesmo resultado em qualquer fuso.
const { hojeEmBrasilia } = await import("../src/lib/format.ts");
const noServidor = (instante) => {
  const antes = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    return hojeEmBrasilia(new Date(instante));
  } finally {
    process.env.TZ = antes;
  }
};
ok(
  noServidor("2026-09-15T02:30:00.000Z") === "2026-09-14",
  `23h30 de Brasília do dia 14 ainda é dia 14 (${noServidor("2026-09-15T02:30:00.000Z")})`,
);
ok(
  noServidor("2026-09-15T03:00:00.000Z") === "2026-09-15",
  `meia-noite em Brasília vira dia 15 (${noServidor("2026-09-15T03:00:00.000Z")})`,
);
ok(
  !("2026-09-14" < noServidor("2026-09-15T02:30:00.000Z")),
  "a conta que vence dia 14 NÃO está vencida às 23h30 do dia 14",
);

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
