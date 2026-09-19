// Testa o índice de saúde do lucro (M01).
//
//   node scripts/indice-saude.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const {
  componentesDoIndice,
  indiceDeSaude,
  pontosQuePuxamParaBaixo,
  faixaDoIndice,
  variacaoDoIndice,
} = await import("../src/lib/indice-saude.ts");

const perfeito = {
  comMargem: 10,
  margemBaixa: 0,
  comparados: 5,
  pagandoCaro: 0,
  ativos: 10,
  parados: 0,
};
ok(indiceDeSaude(componentesDoIndice(perfeito)) === 100, "tudo saudável = 100");

const ruim = {
  comMargem: 10,
  margemBaixa: 10,
  comparados: 4,
  pagandoCaro: 4,
  ativos: 10,
  parados: 10,
};
ok(indiceDeSaude(componentesDoIndice(ruim)) === 0, "tudo ruim = 0");

// 40% margem (metade boa) + 35% custo (todos bons) + 25% giro (todos bons) = 20+35+25 = 80
const meio = {
  comMargem: 10,
  margemBaixa: 5,
  comparados: 4,
  pagandoCaro: 0,
  ativos: 10,
  parados: 0,
};
ok(
  indiceDeSaude(componentesDoIndice(meio)) === 80,
  `pesos 40/35/25 (${indiceDeSaude(componentesDoIndice(meio))})`,
);

console.log("--- sem dado não pune ---");
const semComparacao = {
  comMargem: 10,
  margemBaixa: 0,
  comparados: 0,
  pagandoCaro: 0,
  ativos: 10,
  parados: 0,
};
ok(componentesDoIndice(semComparacao).length === 2, "sem produto comparável, o custo sai da conta");
ok(
  indiceDeSaude(componentesDoIndice(semComparacao)) === 100,
  "e o resto redistribui (100, não 65)",
);
const nada = { comMargem: 0, margemBaixa: 0, comparados: 0, pagandoCaro: 0, ativos: 0, parados: 0 };
ok(indiceDeSaude(componentesDoIndice(nada)) === null, "sem nada a medir = sem índice");

console.log("--- o que puxa para baixo ---");
const puxa = pontosQuePuxamParaBaixo(
  componentesDoIndice({
    comMargem: 10,
    margemBaixa: 6,
    comparados: 4,
    pagandoCaro: 1,
    ativos: 10,
    parados: 1,
  }),
);
ok(puxa[0].chave === "margem", `maior perda primeiro (${puxa.map((p) => p.chave)})`);
ok(puxa.length === 3 && puxa.every((p) => p.perda >= 0), "os três têm problema");
ok(pontosQuePuxamParaBaixo(componentesDoIndice(perfeito)).length === 0, "sem problema, sem lista");
ok(puxa[0].detalhe === "6 de 10 produtos com margem baixa", `detalhe legível (${puxa[0].detalhe})`);

console.log("--- faixas ---");
ok(
  faixaDoIndice(80) === "boa" && faixaDoIndice(68) === "atencao" && faixaDoIndice(30) === "ruim",
  "75+ boa, 50+ atenção, resto ruim",
);

console.log("--- variação no mês ---");
const fotos = [
  { data: "2026-08-25", score: 60 },
  { data: "2026-09-10", score: 65 },
  { data: "2026-09-17", score: 66 },
];
const v = variacaoDoIndice({ data: "2026-09-18", score: 68 }, fotos);
ok(
  v && v.pontos === 8 && v.dias === 24,
  `compara com a foto mais antiga dentro de 35 dias (${JSON.stringify(v)})`,
);
ok(
  variacaoDoIndice({ data: "2026-09-18", score: 68 }, [{ data: "2026-09-15", score: 60 }]) === null,
  "foto de 3 dias não conta",
);
ok(
  variacaoDoIndice({ data: "2026-09-18", score: 68 }, [{ data: "2026-06-01", score: 40 }]) === null,
  "foto de 3 meses não é 'no mês'",
);
ok(variacaoDoIndice({ data: "2026-09-18", score: 68 }, []) === null, "sem histórico, sem variação");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
