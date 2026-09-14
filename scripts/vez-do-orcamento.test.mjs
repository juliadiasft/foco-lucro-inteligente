// De quem é a vez num orçamento.
//
//   node scripts/vez-do-orcamento.test.mjs
//
// O caso que estava errado até 14/09/2026: pedido de orçamento recém-chegado,
// sem proposta nenhuma, não era "a vez" de ninguém — e o fornecedor não via o
// aviso de "Aguardando você" justamente no pedido mais urgente.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { ehMinhaVez } = await import("../src/lib/vez-do-orcamento.ts");
const LOJA = "loja";
const FORNECEDOR = "fornecedor";
const vez = (status, ultimaOrigem, quem) =>
  ehMinhaVez({
    status,
    ultimaOrigem,
    minhaEmpresa: quem === "loja" ? LOJA : FORNECEDOR,
    souComerciante: quem === "loja",
  });

console.log("--- pedido de orçamento recém-chegado, sem proposta ---");
ok(vez("aberto", null, "fornecedor"), "é a vez do FORNECEDOR (era o defeito)");
ok(!vez("aberto", null, "loja"), "não é a vez da loja, que acabou de pedir");

console.log("\n--- depois das propostas ---");
ok(vez("respondido", FORNECEDOR, "loja"), "fornecedor mandou preço: vez da loja");
ok(!vez("respondido", FORNECEDOR, "fornecedor"), "e não do fornecedor");
ok(vez("negociando", LOJA, "fornecedor"), "loja contrapropôs: vez do fornecedor");
ok(!vez("negociando", LOJA, "loja"), "e não da loja");

console.log("\n--- encerrado não espera ninguém ---");
for (const status of ["aceito", "recusado", "cancelado"]) {
  ok(
    !vez(status, FORNECEDOR, "loja") &&
      !vez(status, LOJA, "fornecedor") &&
      !vez(status, null, "fornecedor"),
    `${status}: nenhum dos lados`,
  );
}

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
