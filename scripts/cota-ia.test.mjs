// Testa o estado da cota de IA (X02).
//
//   node scripts/cota-ia.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { estadoDaCota, diaPorExtenso, emDias } = await import("../src/lib/cota-ia.ts");

const agora = new Date("2026-09-18T15:00:00Z");
const e = estadoDaCota(150, 150, agora);
ok(e.esgotada && e.restantes === 0, "150 de 150 = esgotada");
ok(!estadoDaCota(149, 150, agora).esgotada, "149 de 150 ainda tem uma");
ok(estadoDaCota(149, 150, agora).restantes === 1, "restam 1");
ok(!estadoDaCota(0, 0, agora).esgotada, "plano sem IA (limite 0) não é 'esgotada'");
ok(estadoDaCota(400, 300, agora).restantes === 0, "acima do limite nunca dá restante negativo");
ok(
  e.renovaEm.toISOString() === "2026-10-01T00:00:00.000Z",
  `renova em 1º de outubro (${e.renovaEm.toISOString()})`,
);
ok(e.diasParaRenovar === 13, `faltam 13 dias (${e.diasParaRenovar})`);
ok(diaPorExtenso(e.renovaEm) === "1 de outubro", "1 de outubro por extenso");
const dez = estadoDaCota(1, 1, new Date("2026-12-20T10:00:00Z"));
ok(
  dez.renovaEm.toISOString() === "2027-01-01T00:00:00.000Z",
  "dezembro vira janeiro do ano seguinte",
);
ok(
  estadoDaCota(1, 1, new Date("2026-09-30T23:59:00Z")).diasParaRenovar === 1,
  "último dia do mês = em 1 dia",
);
ok(emDias(1) === "em 1 dia" && emDias(24) === "em 24 dias", "singular e plural");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
