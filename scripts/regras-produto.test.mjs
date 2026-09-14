// As réguas de margem baixa e estoque baixo.
//
//   node scripts/regras-produto.test.mjs
//
// Até 14/09/2026 o Painel e a tela de Produtos mediam com réguas diferentes: a
// ração com 16% de margem era "margem muito baixa" num e amarelo "quase ok" no
// outro. As duas telas agora importam src/lib/regras-produto.ts; este teste
// prende os números, para uma mudança de régua ser decisão e não acidente.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { margemBaixa, margemPercentual, estoqueBaixo, MARGEM_BAIXA_PERCENTUAL } =
  await import("../src/lib/regras-produto.ts");

console.log("--- margem ---");
ok(MARGEM_BAIXA_PERCENTUAL === 20, "margem baixa é abaixo de 20%");
ok(
  Math.abs(margemPercentual(78, 92.9) - 16.04) < 0.01,
  "Ração Pedigree: custo 78, venda 92,90 → 16,0%",
);
ok(margemBaixa(78, 92.9), "16% é margem baixa (o Painel e Produtos concordam)");
ok(!margemBaixa(78, 105), "subindo para R$ 105,00 (25,7%) deixa de ser");
ok(!margemBaixa(80, 100), "exatamente 20% não é baixa");
ok(margemPercentual(10, 0) === null, "sem preço de venda não existe margem");
ok(!margemBaixa(10, 0), "e produto sem preço não entra como margem baixa");

console.log("\n--- estoque ---");
ok(estoqueBaixo(6, 6), "no mínimo configurado já é estoque baixo");
ok(!estoqueBaixo(7, 6), "um acima do mínimo não é");
ok(estoqueBaixo(5, 0), "sem mínimo configurado, 5 unidades é o aviso");
ok(!estoqueBaixo(6, 0), "e 6 não é");

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
