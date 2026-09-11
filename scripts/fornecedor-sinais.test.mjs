// Testa a leitura dos sinais da Receita que separa fornecedor de fachada.
//
//   node scripts/fornecedor-sinais.test.mjs
//
// Dois erros aqui custam caro, e em direções opostas. Deixar passar a fachada
// envenena a comparação de preços, que é o produto inteiro: o comerciante
// confere um preço, vai ao fornecedor, descobre que era mentira e não volta.
// E segurar fornecedor honesto na fila faz ele desistir antes de publicar —
// numa plataforma que ainda está enchendo a prateleira.
//
// Por isso o teste cobra as duas coisas: que a empresa comum passa direto, e
// que cada sinal estranho, sozinho, já basta para alguém olhar.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { avaliarFornecedor, anosDeEmpresa, dataDoBanco, tempoDeEmpresa } =
  await import("../src/lib/fornecedor-sinais.ts");

// Uma data fixa: teste que depende do relógio passa hoje e falha no ano que
// vem, sem ninguém ter mexido em nada.
const HOJE = new Date("2026-09-11T12:00:00Z");

// A Aldeia Pet, como a Receita a devolve — empresa comum, que tem que passar.
const COMUM = {
  cnae_fiscal: 4623109, // comércio atacadista de alimentos para animais
  cnae_fiscal_descricao: "Comércio atacadista de alimentos para animais",
  descricao_situacao_cadastral: "ATIVA",
  data_inicio_atividade: "2020-12-08",
  capital_social: 5000,
  porte: "MICRO EMPRESA",
  opcao_pelo_mei: false,
};

console.log("--- a empresa comum passa direto ---");
const comum = avaliarFornecedor(COMUM, { hoje: HOJE });
ok(comum.decisao === "aprovado", `distribuidora ativa desde 2020 é aprovada (${comum.decisao})`);
ok(comum.motivos.length === 0, "sem nenhum motivo inventado");
ok(comum.abertaEm === "2020-12-08", "e guarda a data de abertura, para mostrar ao comerciante");

console.log("\n--- cada sinal, sozinho, já manda para a fila ---");
// Um sinal por vez, sobre a empresa comum. Se algum não disparar sozinho, ele
// só pegaria fachada em companhia de outro — e fachada bem feita tem um só.
const casos = [
  ["empresa inapta", { descricao_situacao_cadastral: "INAPTA" }, "grave", /inapta/],
  ["empresa baixada", { descricao_situacao_cadastral: "BAIXADA" }, "grave", /baixada/],
  ["empresa suspensa", { descricao_situacao_cadastral: "SUSPENSA" }, "grave", /suspensa/],
  ["aberta há 20 dias", { data_inicio_atividade: "2026-08-22" }, "atencao", /20 dias/],
  ["aberta hoje", { data_inicio_atividade: "2026-09-11" }, "atencao", /ontem ou hoje/],
  ["MEI", { opcao_pelo_mei: true, capital_social: 500 }, "atencao", /MEI/],
  ["capital de R$ 100", { capital_social: 100 }, "atencao", /100/],
  [
    "ramo que não é de fornecedor",
    { cnae_fiscal: 6201501, cnae_fiscal_descricao: "Desenvolvimento de programas" },
    "atencao",
    /Desenvolvimento de programas/,
  ],
];
for (const [rotulo, mudanca, peso, texto] of casos) {
  const r = avaliarFornecedor({ ...COMUM, ...mudanca }, { hoje: HOJE });
  ok(r.decisao === "em_analise", `${rotulo} vai para a fila`);
  ok(
    r.motivos.length === 1 && r.motivos[0].peso === peso && texto.test(r.motivos[0].texto),
    `  com o motivo certo, e só ele: "${r.motivos[0]?.texto}"`,
  );
}

const central = avaliarFornecedor(COMUM, { hoje: HOJE, contatosIguais: 40 });
ok(central.decisao === "em_analise", "telefone repetido em 40 empresas vai para a fila");
ok(
  /39 empresas/.test(central.motivos[0]?.texto ?? ""),
  `  e diz quantas: "${central.motivos[0]?.texto}"`,
);

console.log("\n--- o que tem explicação não vira alarme ---");
// Os falsos alarmes custam tanto quanto a fachada: uma fila cheia de empresa
// honesta ensina a pessoa a aprovar sem olhar.
ok(
  avaliarFornecedor({ ...COMUM, capital_social: 1000 }, { hoje: HOJE }).decisao === "aprovado",
  "LTDA com R$ 1.000 de capital, que é o mais comum, passa",
);
ok(
  avaliarFornecedor({ ...COMUM, data_inicio_atividade: "2026-05-01" }, { hoje: HOJE }).decisao ===
    "aprovado",
  "empresa com quatro meses passa: todo fornecedor foi novo um dia",
);
ok(
  avaliarFornecedor(COMUM, { hoje: HOJE, contatosIguais: 3 }).decisao === "aprovado",
  "três empresas no mesmo telefone — matriz e duas filiais — passam",
);
const meiComCapitalBaixo = avaliarFornecedor(
  { ...COMUM, opcao_pelo_mei: true, capital_social: 500 },
  { hoje: HOJE },
);
ok(
  meiComCapitalBaixo.motivos.length === 1,
  "MEI com capital baixo é um motivo só: capital baixo é o normal do MEI",
);
ok(
  avaliarFornecedor({ ...COMUM, descricao_situacao_cadastral: "ativa" }, { hoje: HOJE }).decisao ===
    "aprovado",
  "'ativa' em minúsculas é ativa",
);

console.log("\n--- dado que faltou não inventa suspeita ---");
// A BrasilAPI às vezes devolve campo vazio. Isso não é sinal de fachada — é
// só um campo que não veio.
const semDados = avaliarFornecedor(
  { cnae_fiscal: 4623109, descricao_situacao_cadastral: "ATIVA" },
  { hoje: HOJE },
);
ok(semDados.decisao === "aprovado", "sem data, capital e porte, mas ativa e do ramo: passa");
ok(semDados.abertaEm === null, "e não inventa data de abertura");

console.log("\n--- vários sinais juntos aparecem todos ---");
const fachada = avaliarFornecedor(
  {
    cnae_fiscal: 4623109,
    descricao_situacao_cadastral: "ATIVA",
    data_inicio_atividade: "2026-09-01",
    capital_social: 50,
    opcao_pelo_mei: false,
  },
  { hoje: HOJE, contatosIguais: 25 },
);
ok(
  fachada.motivos.length === 3,
  `aberta há dias, capital de R$ 50 e central de 25: ${fachada.motivos.length} motivos`,
);

console.log("\n--- o que o comerciante lê ---");
ok(
  tempoDeEmpresa("2020-12-08", HOJE) === "há 5 anos",
  `2020 → "${tempoDeEmpresa("2020-12-08", HOJE)}"`,
);
ok(
  tempoDeEmpresa("2025-09-01", HOJE) === "há 1 ano",
  `um ano → "${tempoDeEmpresa("2025-09-01", HOJE)}"`,
);
ok(
  tempoDeEmpresa("2026-05-01", HOJE) === "há 4 meses",
  `maio → "${tempoDeEmpresa("2026-05-01", HOJE)}"`,
);
ok(tempoDeEmpresa("2026-09-01", HOJE) === "há menos de um mês", "dez dias → há menos de um mês");
ok(tempoDeEmpresa(null, HOJE) === null, "sem data, não mostra nada em vez de mostrar errado");

console.log("\n--- a idade só aparece a partir de um ano ---");
// "Aberta há 3 meses" ao lado do nome afasta cliente de fornecedor honesto.
ok(anosDeEmpresa("2020-12-08", HOJE) === 5, "2020 → 5 anos, aparece");
ok(anosDeEmpresa("2026-05-01", HOJE) === 0, "maio deste ano → 0, não aparece");
ok(anosDeEmpresa("2025-09-12", HOJE) === 0, "um dia antes de fazer um ano → 0, não aparece");
ok(anosDeEmpresa("2025-09-10", HOJE) === 1, "um ano e um dia → 1, aparece");
ok(anosDeEmpresa("2030-01-01", HOJE) === null, "data no futuro não vira idade negativa");

console.log("\n--- a data sai igual dos dois bancos ---");
// Produção devolve Date; o banco local devolve texto. Uma tela que só
// tratasse um dos dois quebraria no outro — e só o local roda nos testes.
ok(dataDoBanco(new Date("2020-12-08T00:00:00Z")) === "2020-12-08", "Date → 2020-12-08");
ok(dataDoBanco("2020-12-08") === "2020-12-08", "texto → 2020-12-08");
ok(dataDoBanco(null) === null, "nulo continua nulo");

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
