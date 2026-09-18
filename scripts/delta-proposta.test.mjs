// Testa a proposta contra o custo de hoje.
//
//   node scripts/delta-proposta.test.mjs
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { deltaDaProposta } = await import("../src/lib/delta-proposta.ts");

const item = (extra = {}) => ({
  nome: "Ração 15kg",
  precoDaEmbalagem: 150,
  tamanhoDaEmbalagem: 15,
  quantidade: 4,
  unidadeBase: "kg",
  custoAtual: 12,
  origemDoCusto: "digitado",
  unidadeDoProduto: "kg",
  ...extra,
});

// 12 - 150/15 = 2 por kg, x 15 kg x 4 embalagens = 120
ok(deltaDaProposta([item()])?.economia === 120, "abaixo do custo: R$ 120 de economia");
ok(
  deltaDaProposta([item({ precoDaEmbalagem: 240 })])?.economia === -240,
  "acima do custo: economia negativa (12 - 16 = -4 x 60 kg = -240)",
);
ok(deltaDaProposta([item({ origemDoCusto: "real" })])?.economia === 120, "custo de compra conta");
ok(deltaDaProposta([item({ origemDoCusto: "estimado" })]) === null, "custo estimado NÃO conta");
ok(deltaDaProposta([item({ custoAtual: null, origemDoCusto: null })]) === null, "sem custo: nada");
ok(deltaDaProposta([item({ custoAtual: 0 })]) === null, "custo zero: nada");
ok(
  deltaDaProposta([item({ unidadeDoProduto: "un" })]) === null,
  "unidade diferente (kg contra un) não compara",
);
ok(
  deltaDaProposta([item({ unidadeDoProduto: " KG " })])?.economia === 120,
  "unidade ignora caixa e espaço",
);
ok(deltaDaProposta([]) === null, "proposta sem itens: nada");

const misto = deltaDaProposta([item(), item({ custoAtual: null, origemDoCusto: null })]);
ok(misto?.comparados === 1 && misto?.total === 2, "parcial: 1 de 2 itens comparados");
ok(misto?.economia === 120, "parcial soma só o comparado");

const soma = deltaDaProposta([item(), item({ precoDaEmbalagem: 240 })]);
ok(soma?.economia === -120, "um abaixo e um acima se compensam (120 - 240)");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\nTudo certo.");
