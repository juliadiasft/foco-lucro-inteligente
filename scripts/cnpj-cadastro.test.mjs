// Testa o autopreenchimento do cadastro pelo CNPJ.
//
//   node scripts/cnpj-cadastro.test.mjs
//
// A primeira parte roda offline: é o mapa de CNAE para nicho, que é onde mora
// a chance de errar em silêncio — um comerciante cair no nicho errado só
// aparece semanas depois, quando ele reclama que os fornecedores não têm nada
// a ver com a loja dele.
//
// A segunda parte encosta na BrasilAPI de verdade e só roda com --rede, para
// que o teste não passe a depender da internet no dia a dia.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { normalizarCnae, segmentoDoCnae, segmentosSugeridos } =
  await import("../src/lib/cnae-segmento.ts").catch(() => ({}));

if (!segmentoDoCnae) {
  console.log("  (pulado: este runtime não importa .ts direto)");
  process.exit(0);
}

console.log("--- o zero à esquerda que a Receita come ---");
// A Receita entrega o CNAE como número: 0600-0/01 chega como 600001. Sem o
// zero à esquerda, o grupo lido seria "6000" em vez de "0600".
ok(normalizarCnae(600001) === "0600001", `600001 vira ${normalizarCnae(600001)}`);
ok(normalizarCnae("4712-1/00") === "4712100", `"4712-1/00" vira ${normalizarCnae("4712-1/00")}`);
ok(normalizarCnae(null) === null, "vazio devolve null em vez de quebrar");

console.log("\n--- cada CNAE cai no nicho certo ---");
const casos = [
  [4712100, "mercearia", "minimercado"],
  [4711302, "mercado", "supermercado"],
  [4721102, "padaria", "padaria"],
  [4722901, "acougue", "açougue"],
  [4724500, "hortifruti", "hortifrúti"],
  [4771701, "farmacia", "farmácia"],
  [4781400, "roupas", "loja de roupas"],
  [4744001, "construcao", "material de construção"],
  [4530703, "autopecas", "autopeças"],
  [4635402, "distribuidora", "atacado de bebidas"],
];
for (const [cnae, esperado, rotulo] of casos) {
  const obtido = segmentoDoCnae(cnae);
  ok(obtido === esperado, `${rotulo} (${cnae}) → ${obtido}`);
}

console.log("\n--- a subclasse ganha do grupo quando discorda ---");
// 5611-2/05 mora no grupo dos restaurantes, mas é bar.
ok(segmentoDoCnae(5611201) === "lanchonete", "5611-2/01 restaurante → lanchonete");
ok(segmentoDoCnae(5611205) === "bar", "5611-2/05 bar → bar, e não lanchonete");
ok(segmentoDoCnae(4789004) === "pet", "4789-0/04 animais domésticos → pet");

console.log("\n--- CNAE que não é comércio não inventa nicho ---");
ok(segmentoDoCnae(600001) === null, "extração de petróleo não vira nicho");
ok(segmentoDoCnae(6201501) === null, "desenvolvimento de software não vira nicho");

console.log("\n--- principal e secundários, sem repetir ---");
const varios = segmentosSugeridos(4712100, [4721102, 4712100, 9999999]);
ok(
  varios.length === 2 && varios[0] === "mercearia" && varios[1] === "padaria",
  `mercearia com padaria anexa → ${varios.join(", ")}`,
);
ok(segmentosSugeridos(null, []).length === 0, "sem CNAE, nenhum nicho é sugerido");

// Este caso veio da tela, não da minha cabeça: o CNPJ real da Magazine Luiza
// acendeu sete nichos de uma vez pelos CNAEs secundários. Sem teto, quem
// cadastra recebe fornecedor de sete ramos que não têm a ver com a loja.
const varejaoGigante = segmentosSugeridos(
  4713004,
  [4711302, 4723700, 4635402, 4771701, 4772500, 4753900, 4781400],
);
ok(
  varejaoGigante.length === 3,
  `varejista com CNAE para tudo para em 3 nichos, não 7 → ${varejaoGigante.join(", ")}`,
);
ok(varejaoGigante[0] === "utilidades", "o CNAE principal continua vindo primeiro");

if (process.argv.includes("--rede")) {
  console.log("\n--- a BrasilAPI ainda responde o que esperamos ---");
  // O mesmo User-Agent da chamada real. Sem ele a BrasilAPI devolve 403 — foi
  // assim que descobrimos que o fetch do Node não manda um sozinho, e que a
  // integração teria ido quebrada para produção mesmo funcionando no curl.
  const cabecalhos = {
    Accept: "application/json",
    "User-Agent": "CentralDoComerciante/1.0 (+https://central-do-comerciante.onrender.com)",
  };
  try {
    const resposta = await fetch("https://brasilapi.com.br/api/cnpj/v1/33000167000101", {
      headers: cabecalhos,
      signal: AbortSignal.timeout(15000),
    });
    ok(resposta.ok, `consulta respondeu ${resposta.status}`);
    const dados = await resposta.json();
    for (const campo of [
      "razao_social",
      "nome_fantasia",
      "municipio",
      "uf",
      "cnae_fiscal",
      "descricao_situacao_cadastral",
    ]) {
      ok(campo in dados, `campo ${campo} continua existindo na resposta`);
    }
    const inexistente = await fetch("https://brasilapi.com.br/api/cnpj/v1/00000000000000", {
      headers: cabecalhos,
      signal: AbortSignal.timeout(15000),
    });
    ok(inexistente.status === 404, `CNPJ inexistente devolve ${inexistente.status}`);
  } catch (erro) {
    ok(false, `não consegui falar com a BrasilAPI: ${erro.message}`);
  }
} else {
  console.log("\n(parte de rede pulada — rode com --rede para checar a BrasilAPI)");
}

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
