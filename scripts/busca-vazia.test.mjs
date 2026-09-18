// Testa a análise da busca vazia (X04).
//
//   node scripts/busca-vazia.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { analisarBuscaVazia, fornecedoresDistintos, nFornecedores } =
  await import("../src/lib/busca-vazia.ts");

const a = analisarBuscaVazia([
  { chave: "prazo", texto: "Até 1 dia(s)", fornecedores: 2 },
  { chave: "uf", texto: "SP", fornecedores: 5 },
  { chave: "pronta", texto: "Pronta entrega", fornecedores: 0 },
]);
ok(
  a.culpados.map((c) => c.chave).join() === "uf,prazo",
  "culpados por quem mais traz gente de volta",
);
ok(
  a.inocentes.length === 1 && a.inocentes[0].chave === "pronta",
  "quem não elimina ninguém fica à parte",
);
ok(!a.soCombinados, "há culpado sozinho");

const b = analisarBuscaVazia([
  { chave: "uf", texto: "SP", fornecedores: 0 },
  { chave: "prazo", texto: "Até 1", fornecedores: 0 },
]);
ok(
  b.soCombinados && b.culpados.length === 0,
  "dois filtros, nenhum resolve sozinho = só combinados",
);
ok(
  !analisarBuscaVazia([{ chave: "uf", texto: "SP", fornecedores: 0 }]).soCombinados,
  "um filtro só nunca é 'combinado'",
);

const r = [
  { offers: [{ supplierCompanyId: "a" }, { supplierCompanyId: "b" }] },
  { offers: [{ supplierCompanyId: "a" }] },
];
ok(fornecedoresDistintos(r) === 2, "conta fornecedores distintos, não ofertas");
ok(
  nFornecedores(1) === "1 fornecedor" && nFornecedores(3) === "3 fornecedores",
  "singular e plural",
);

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
