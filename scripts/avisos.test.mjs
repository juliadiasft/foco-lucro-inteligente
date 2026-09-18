// Testa a central de avisos e a regra do push.
//
//   node scripts/avisos.test.mjs
//
// O erro caro aqui é um aviso de confirmação virar push: a pessoa desliga as
// notificações e perde as que valiam. E o inverso, orçamento respondido
// ficar calado.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { categoriaDoTipo, tipoFazPush, agruparAvisos, CATEGORIAS } =
  await import("../src/lib/avisos.ts");

console.log("--- categoria de cada tipo ---");
ok(categoriaDoTipo("supplier_opportunity") === "dinheiro_na_mesa", "economia é dinheiro na mesa");
ok(
  categoriaDoTipo("orcamento_respondido") === "precisa_de_voce",
  "orçamento respondido precisa de você",
);
ok(
  categoriaDoTipo("orcamento_novo") === "precisa_de_voce",
  "orçamento novo (fornecedor) precisa de você",
);
ok(categoriaDoTipo("pedido_novo") === "precisa_de_voce", "pedido novo precisa de resposta");
ok(
  categoriaDoTipo("pedido_atualizado") === "so_para_saber",
  "atualização de pedido é só para saber",
);
ok(categoriaDoTipo("proposta_aceita") === "so_para_saber", "proposta aceita é só para saber");
ok(
  categoriaDoTipo("tipo_que_nao_existe") === "so_para_saber",
  "tipo desconhecido cai no menos ruidoso",
);

console.log("--- quem toca no celular ---");
ok(tipoFazPush("supplier_opportunity"), "economia faz push");
ok(tipoFazPush("orcamento_respondido"), "orçamento respondido faz push");
ok(tipoFazPush("pedido_novo"), "pedido novo faz push");
ok(!tipoFazPush("pedido_atualizado"), "atualização de pedido NÃO faz push");
ok(!tipoFazPush("proposta_aceita"), "proposta aceita NÃO faz push");
ok(!tipoFazPush("system"), "aviso do sistema NÃO faz push");

console.log("--- agrupamento ---");
const grupos = agruparAvisos([
  { type: "system", id: 1 },
  { type: "supplier_opportunity", id: 2 },
  { type: "orcamento_novo", id: 3 },
  { type: "orcamento_respondido", id: 4 },
]);
ok(
  grupos.map((g) => g.id).join() === "precisa_de_voce,dinheiro_na_mesa,so_para_saber",
  "ordem fixa das categorias",
);
ok(grupos[0].avisos.length === 2, "dois avisos em 'precisa de você'");
ok(agruparAvisos([{ type: "system" }]).length === 1, "grupo vazio não aparece");
ok(agruparAvisos([]).length === 0, "sem avisos, sem grupos");
ok(CATEGORIAS.length === 3, "três categorias");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\nTudo certo.");
