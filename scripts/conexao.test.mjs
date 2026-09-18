// Testa a faixa de "sem internet" (X06).
//
//   node scripts/conexao.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { ultimoCarregamento, mensagemSemInternet } = await import("../src/lib/conexao.ts");

ok(
  ultimoCarregamento([{ dataUpdatedAt: 100 }, { dataUpdatedAt: 300 }, { dataUpdatedAt: 200 }]) ===
    300,
  "pega o carregamento mais recente",
);
ok(
  ultimoCarregamento([{ dataUpdatedAt: 0 }]) === null,
  "consulta que nunca carregou (0) não conta",
);
ok(ultimoCarregamento([]) === null, "sem consultas = nulo");
ok(mensagemSemInternet("7:40").includes("às 7:40"), "diz a hora");
ok(!mensagemSemInternet(null).includes("carregado às"), "sem hora, não inventa uma");
ok(
  !/sozinh|offline|sobe/i.test(mensagemSemInternet("7:40")),
  "não promete sincronizar nem cadastrar offline",
);

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
