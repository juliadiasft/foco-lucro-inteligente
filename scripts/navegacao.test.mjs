// Testa o agrupamento das cinco abas do comerciante.
//
//   node scripts/navegacao.test.mjs
//
// Cada tela do app pertence a exatamente uma aba. O erro fácil é uma tela
// ficar sem dono: a barra de baixo fica sem nenhuma aba acesa e a pessoa não
// sabe onde está. O outro é um prefixo pegar o vizinho — `/orcamentos` não
// pode reclamar `/orcamentos-antigos`.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { abaDaRota, mostraSubtelasDeComprar, subtelaAtiva, SUBTELAS_DE_COMPRAR, ITENS_DE_MAIS } =
  await import("../src/lib/navegacao.ts");

console.log("--- as quatro abas com uma tela só ---");
ok(abaDaRota("/dashboard") === "painel", "/dashboard é o Painel");
ok(abaDaRota("/produtos") === "produtos", "/produtos é Produtos");
ok(abaDaRota("/consultor") === "assistente", "/consultor é o Assistente");
ok(abaDaRota("/mais") === "mais", "/mais é Mais");

console.log("\n--- Comprar absorve o fluxo inteiro ---");
for (const rota of ["/comprar", "/fornecedores", "/orcamentos", "/pedidos", "/conversas"])
  ok(abaDaRota(rota) === "comprar", `${rota} fica dentro de Comprar`);
ok(abaDaRota("/orcamentos/123") === "comprar", "um orçamento aberto continua em Comprar");
ok(mostraSubtelasDeComprar("/pedidos"), "a faixa de subtelas aparece em Pedidos");
ok(!mostraSubtelasDeComprar("/produtos"), "e não aparece em Produtos");

console.log("\n--- Mais guarda o resto, inclusive o lançamento manual ---");
for (const item of ITENS_DE_MAIS)
  ok(abaDaRota(item.to) === "mais", `${item.to} (${item.label}) fica em Mais`);

console.log("\n--- prefixo não pega vizinho ---");
ok(abaDaRota("/orcamentos-antigos") === "painel", "/orcamentos-antigos não é Comprar");
ok(!subtelaAtiva("/pedidosx", "/pedidos"), "/pedidosx não acende Pedidos");
ok(subtelaAtiva("/pedidos/9", "/pedidos"), "/pedidos/9 acende Pedidos");

console.log("\n--- rota sem dono nunca deixa a barra apagada ---");
ok(abaDaRota("/onboarding") === "painel", "/onboarding cai no Painel");
ok(abaDaRota("/") === "painel", "a raiz cai no Painel");

console.log("\n--- nenhuma tela em duas abas ---");
const todas = [...SUBTELAS_DE_COMPRAR.map((s) => s.to), ...ITENS_DE_MAIS.map((i) => i.to)];
ok(new Set(todas).size === todas.length, "nenhum caminho repetido entre Comprar e Mais");

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
