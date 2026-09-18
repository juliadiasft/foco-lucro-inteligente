// Testa a posição do fornecedor (S07).
//
//   node scripts/desempenho-fornecedor.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { componentes, pontuacao, posicaoNaRegiao, acoesParaSubir, horasPorExtenso } =
  await import("../src/lib/desempenho-fornecedor.ts");

const bom = { recebidos: 10, respondidos: 10, medianaHoras: 1, ofertas: 20, ofertasVelhas: 0 };
const ruim = { recebidos: 10, respondidos: 4, medianaHoras: 30, ofertas: 20, ofertasVelhas: 15 };

ok(pontuacao(bom) === 100, "tudo em dia = 100");
ok(pontuacao(ruim) < 50, `atrasado e parado fica baixo (${Math.round(pontuacao(ruim))})`);
ok(pontuacao(bom) > pontuacao(ruim), "quem responde e mantém preço em dia fica à frente");

const novo = { recebidos: 0, respondidos: 0, medianaHoras: null, ofertas: 10, ofertasVelhas: 0 };
ok(
  pontuacao(novo) === 100,
  "fornecedor novo só com preço em dia não é punido pela falta de histórico",
);
ok(
  pontuacao({ recebidos: 0, respondidos: 0, medianaHoras: null, ofertas: 0, ofertasVelhas: 0 }) ===
    null,
  "sem nenhum sinal = sem pontuação",
);

ok(componentes({ ...bom, medianaHoras: 2 }).tempo === 1, "2h = nota cheia de tempo");
ok(componentes({ ...bom, medianaHoras: 48 }).tempo === 0, "48h = zero de tempo");
ok(componentes({ ...bom, medianaHoras: 200 }).tempo === 0, "nunca abaixo de zero");

const p = posicaoNaRegiao(pontuacao(ruim), [pontuacao(bom), pontuacao(ruim), 70, null]);
ok(p.posicao === 3 && p.total === 3, `3º de 3 (sem pontuação não conta) — ${p.posicao}/${p.total}`);
ok(posicaoNaRegiao(50, [50, 50, 50]).posicao === 1, "empate divide a melhor posição");
ok(posicaoNaRegiao(null, [10, 20]) === null, "sem pontuação, sem posição");

const acoes = acoesParaSubir(ruim, 3);
ok(acoes.length === 3, `três ações (${acoes.length})`);
ok(
  acoes.every((a) => a.pontos >= 1),
  "só ação que rende ponto",
);
ok(
  acoes.every((a, i) => i === 0 || acoes[i - 1].pontos >= a.pontos),
  "mais rendosa primeiro",
);
ok(acoesParaSubir(bom, 0).length === 0, "quem já está no topo não recebe tarefa inventada");
ok(
  acoesParaSubir(ruim, 0).every((a) => a.chave !== "responder_abertos"),
  "sem orçamento aberto, sem 'responder abertos'",
);

ok(horasPorExtenso(4.333) === "4h20", `4h20 (${horasPorExtenso(4.333)})`);
ok(horasPorExtenso(0.5) === "30min", "30min");
ok(horasPorExtenso(26) === "1d2h", "1d2h");
ok(horasPorExtenso(3) === "3h", "3h");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
