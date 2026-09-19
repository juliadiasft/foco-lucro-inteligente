// Testa a regra de degraus da premiação (mascotinho a partir de R$ 10 mil).
//
//   node scripts/premiacao.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { DEGRAUS, estadoDaPremiacao, degrausNovos } = await import("../src/lib/premiacao.ts");

console.log("--- abaixo do primeiro degrau ---");
const zero = estadoDaPremiacao(0);
ok(zero.atual === null && zero.conquistados.length === 0, "R$ 0: nada conquistado");
ok(zero.proximo?.valor === 10_000 && zero.falta === 10_000, "faltam R$ 10 mil");
const meio = estadoDaPremiacao(2_500);
ok(meio.progressoPct === 25 && meio.falta === 7_500, "R$ 2.500 = 25% do caminho, faltam 7.500");
ok(estadoDaPremiacao(9_999.99).atual === null, "R$ 9.999,99 ainda não é degrau");

console.log("--- primeiro degrau: o mascotinho ---");
const dez = estadoDaPremiacao(10_000);
ok(
  dez.atual?.valor === 10_000 && dez.atual.premioFisico,
  "R$ 10.000 exatos conquistam, com prêmio físico",
);
ok(dez.proximo?.valor === 50_000 && dez.progressoPct === 0, "e a barra recomeça rumo aos 50 mil");
ok(DEGRAUS.filter((d) => d.premioFisico).length === 1, "só o degrau de 10 mil tem entrega física");

console.log("--- barra entre degraus ---");
const p = estadoDaPremiacao(30_000);
ok(p.progressoPct === 50, "R$ 30 mil está na metade entre 10 e 50 mil");
ok(p.conquistados.length === 1, "só o de 10 mil foi conquistado");

console.log("--- topo e entradas ruins ---");
const topo = estadoDaPremiacao(5_000_000);
ok(
  topo.proximo === null && topo.progressoPct === 100 && topo.falta === 0,
  "acima do último degrau: sem próximo",
);
ok(topo.conquistados.length === DEGRAUS.length, "todos conquistados");
ok(
  estadoDaPremiacao(-50).total === 0 && estadoDaPremiacao(NaN).total === 0,
  "negativo ou NaN vira zero",
);
ok(
  DEGRAUS.every((d, i) => i === 0 || d.valor > DEGRAUS[i - 1].valor),
  "degraus estritamente crescentes",
);

console.log("--- registrar a conquista uma vez só ---");
ok(degrausNovos(12_000, []).length === 1, "12 mil sem registro: 1 degrau novo");
ok(degrausNovos(12_000, [10_000]).length === 0, "já registrado: nada novo");
ok(
  degrausNovos(120_000, [10_000])
    .map((d) => d.valor)
    .join() === "50000,100000",
  "salto de 10 para 120 mil registra os dois que faltam",
);
ok(
  degrausNovos(4_000, [10_000]).length === 0,
  "total que caiu (cancelamento) não remove nem repete",
);

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
