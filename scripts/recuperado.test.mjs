// Testa o extrato do "já recuperado".
//
//   node scripts/recuperado.test.mjs
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { totalDoExtrato, ordenarExtrato, filtrarExtrato, totalDoMes } =
  await import("../src/lib/recuperado.ts");

const item = (id, tipo, valor, em) => ({ id, tipo, titulo: id, detalhe: "", valor, em });
const itens = [
  item("a", "compra", 100.1, "2026-09-02T10:00:00Z"),
  item("b", "negociacao", 50.2, "2026-09-10T10:00:00Z"),
  item("c", "compra", 30, "2026-08-20T10:00:00Z"),
];

ok(totalDoExtrato(itens) === 180.3, "soma sem erro de ponto flutuante (100,10+50,20+30)");
ok(totalDoExtrato([]) === 0, "extrato vazio soma zero");
ok(
  ordenarExtrato(itens)
    .map((i) => i.id)
    .join() === "b,a,c",
  "mais recente primeiro",
);
ok(itens[0].id === "a", "ordenar não mexe na lista original");
ok(filtrarExtrato(itens, "compra").length === 2, "filtra compras");
ok(filtrarExtrato(itens, "negociacao").length === 1, "filtra negociações");
ok(filtrarExtrato(itens, "todas").length === 3, "todas devolve tudo");
ok(totalDoMes(itens, new Date("2026-09-18T12:00:00Z")) === 150.3, "só setembro no total do mês");
ok(totalDoMes(itens, new Date("2027-09-18T12:00:00Z")) === 0, "mesmo mês de outro ano não conta");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\nTudo certo.");
