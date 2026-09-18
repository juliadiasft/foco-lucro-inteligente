// Testa os filtros de orçamento do fornecedor (S06).
//
//   node scripts/filtro-orcamentos.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { passaNoFiltro, efeitoDoFiltro, filtroAtivo, SEM_FILTRO } =
  await import("../src/lib/filtro-orcamentos.ts");

const eu = { cidade: "Curitiba", uf: "PR" };
const pedido = (extra = {}) => ({
  valorEstimado: 1000,
  comerciante: { cidade: "Curitiba", uf: "PR", segmentos: ["pet"] },
  todosDisponiveis: true,
  respondido: false,
  ...extra,
});

ok(passaNoFiltro(pedido(), SEM_FILTRO, eu), "sem filtro tudo passa");
ok(!filtroAtivo(SEM_FILTRO), "sem filtro não é filtro ativo");

console.log("--- valor ---");
const acima = { ...SEM_FILTRO, valorMinimo: 800 };
ok(passaNoFiltro(pedido({ valorEstimado: 900 }), acima, eu), "900 passa em 'acima de 800'");
ok(!passaNoFiltro(pedido({ valorEstimado: 500 }), acima, eu), "500 é escondido");
ok(passaNoFiltro(pedido({ valorEstimado: null }), acima, eu), "sem valor estimado não é escondido");

console.log("--- alcance ---");
const soUf = { ...SEM_FILTRO, alcance: "uf" };
ok(passaNoFiltro(pedido(), soUf, eu), "mesma UF passa");
ok(
  !passaNoFiltro(pedido({ comerciante: { cidade: "Recife", uf: "PE", segmentos: [] } }), soUf, eu),
  "outra UF é escondida",
);
const soCidade = { ...SEM_FILTRO, alcance: "cidade" };
ok(
  !passaNoFiltro(
    pedido({ comerciante: { cidade: "Londrina", uf: "PR", segmentos: [] } }),
    soCidade,
    eu,
  ),
  "outra cidade é escondida",
);
ok(
  passaNoFiltro(
    pedido({ comerciante: { cidade: "curitiba ", uf: "pr", segmentos: [] } }),
    soCidade,
    eu,
  ),
  "caixa e espaço não importam",
);
ok(
  passaNoFiltro(pedido({ comerciante: { cidade: null, uf: null, segmentos: [] } }), soCidade, eu),
  "comerciante sem cidade não é escondido",
);

console.log("--- nicho e estoque ---");
const soPet = { ...SEM_FILTRO, segmentos: ["pet"] };
ok(passaNoFiltro(pedido(), soPet, eu), "nicho bate");
ok(
  !passaNoFiltro(
    pedido({ comerciante: { cidade: null, uf: null, segmentos: ["adega"] } }),
    soPet,
    eu,
  ),
  "nicho diferente é escondido",
);
ok(
  passaNoFiltro(pedido({ comerciante: { cidade: null, uf: null, segmentos: [] } }), soPet, eu),
  "comerciante sem nicho não é escondido",
);
const estoque = { ...SEM_FILTRO, soComEstoque: true };
ok(
  !passaNoFiltro(pedido({ todosDisponiveis: false }), estoque, eu),
  "item indisponível é escondido",
);

console.log("--- efeito na taxa ---");
const hist = [
  pedido({ valorEstimado: 500, respondido: true }),
  pedido({ valorEstimado: 400, respondido: false }),
  pedido({ valorEstimado: 2000, respondido: true }),
  pedido({ valorEstimado: 3000, respondido: true }),
];
const ef = efeitoDoFiltro(hist, acima, eu);
ok(ef.total === 4, "4 pedidos no histórico");
ok(ef.escondidos === 2, `2 escondidos (${ef.escondidos})`);
ok(ef.valorEscondido === 900, `R$ 900 escondidos (${ef.valorEscondido})`);
ok(ef.jaRespondidos === 1, "1 deles ele tinha respondido");
ok(ef.taxaAtual === 0.75, "taxa hoje 75%");
ok(ef.taxaComFiltro === 0.5, `taxa com filtro 50% (${ef.taxaComFiltro})`);
ok(efeitoDoFiltro([], acima, eu).taxaAtual === null, "sem histórico, sem taxa");
ok(efeitoDoFiltro(hist, SEM_FILTRO, eu).taxaComFiltro === 0.75, "sem filtro a taxa não muda");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
