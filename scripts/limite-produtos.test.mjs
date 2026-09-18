// Testa o limite de produtos com saída (X01).
//
//   node scripts/limite-produtos.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { estadoDoLimite, produtosParados, proximoPlano } =
  await import("../src/lib/limite-produtos.ts");

console.log("--- estado do limite ---");
const cheio = estadoDoLimite("profissional", 150);
ok(cheio.cheio && cheio.vagas === 0 && cheio.limite === 150, "150 de 150 = cheio, 0 vagas");
ok(!estadoDoLimite("profissional", 149).cheio, "149 de 150 ainda cabe");
ok(estadoDoLimite("essencial", 50).cheio, "essencial cheia com 50");
ok(!estadoDoLimite("premium", 5000).cheio, "premium nunca enche");
ok(estadoDoLimite("profissional", 170).vagas === 0, "acima do limite (plano rebaixado) = 0 vagas, não negativo");

console.log("--- produtos parados ---");
const hoje = new Date("2026-09-18T12:00:00Z");
const dias = (n) => new Date(hoje.getTime() - n * 86_400_000);
const lista = produtosParados(
  [
    { id: "a", name: "Suco", ultimaVenda: dias(97), criadoEm: dias(400) },
    { id: "b", name: "Bala", ultimaVenda: dias(142), criadoEm: dias(400) },
    { id: "c", name: "Vende bem", ultimaVenda: dias(3), criadoEm: dias(400) },
    { id: "d", name: "Novo sem venda", ultimaVenda: null, criadoEm: dias(10) },
    { id: "e", name: "Velho sem venda", ultimaVenda: null, criadoEm: dias(200) },
    { id: "f", name: "Exatos 90", ultimaVenda: dias(90), criadoEm: dias(400) },
  ],
  hoje,
);
ok(lista.map((p) => p.id).join() === "e,b,a", `só passou de 90 dias, mais antigo primeiro (${lista.map((p) => p.id)})`);
ok(!lista.some((p) => p.id === "d"), "cadastrado há 10 dias não é parado");
ok(!lista.some((p) => p.id === "f"), "exatamente 90 dias ainda não conta");
ok(lista.find((p) => p.id === "b").diasParado === 142, "diz quantos dias (142)");

console.log("--- próximo plano ---");
const prof = proximoPlano("profissional");
ok(prof.plano === "premium" && prof.produtos === null && prof.preco === 179.9, "profissional → premium ilimitado R$ 179,90");
ok(proximoPlano("essencial").plano === "profissional" && proximoPlano("essencial").produtos === 150, "essencial → profissional 150");
ok(proximoPlano("premium") === null, "premium não tem próximo");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
