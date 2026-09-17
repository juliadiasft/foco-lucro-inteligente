// Testa o aviso de configuração faltando.
//
//   node scripts/configuracao.test.mjs
//
// Existe por causa de 17/09/2026: o DOCUMENT_HASH_SECRET em produção tinha 26
// caracteres, dois a menos que o mínimo, e todo cadastro novo falhou por uma
// semana sem ninguém perceber. O site respondia, o banco respondia, o monitor
// dizia "ok".
//
// O que este teste protege não é a conta de caracteres — é a promessa de que
// uma configuração errada aparece em algum lugar que alguém olha, em vez de
// falhar calada.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { problemasDeConfiguracao, avisoParaOLog, TAMANHO_MINIMO_DO_SEGREDO } =
  await import("../src/lib/configuracao.ts");

const segredoBom = "x".repeat(TAMANHO_MINIMO_DO_SEGREDO);
const segredoDaJulia = "x".repeat(26); // o valor real que estava no Render

console.log("--- o caso que aconteceu de verdade ---");
const curto = problemasDeConfiguracao({
  NODE_ENV: "production",
  DOCUMENT_HASH_SECRET: segredoDaJulia,
});
ok(curto.length === 1, `segredo de 26 caracteres vira problema (${curto.length} problema)`);
ok(
  curto[0]?.chave === "DOCUMENT_HASH_SECRET",
  `o problema aponta a variável certa (${curto[0]?.chave})`,
);
ok(
  (curto[0]?.oQueQuebra || "").includes("26") &&
    (curto[0]?.oQueQuebra || "").includes("criar conta"),
  "o aviso diz o tamanho encontrado e que ninguém consegue criar conta",
);
ok(
  (curto[0]?.comoResolver || "").includes("Render"),
  "o aviso diz onde consertar, e não só que está errado",
);

console.log("\n--- as outras formas de estar errado ---");
ok(
  problemasDeConfiguracao({ NODE_ENV: "production" }).length === 1,
  "variável ausente também vira problema",
);
ok(
  problemasDeConfiguracao({ NODE_ENV: "production", DOCUMENT_HASH_SECRET: "" }).length === 1,
  "variável vazia também vira problema",
);

console.log("\n--- o que não pode virar alarme falso ---");
ok(
  problemasDeConfiguracao({ NODE_ENV: "production", DOCUMENT_HASH_SECRET: segredoBom }).length ===
    0,
  `segredo no mínimo (${TAMANHO_MINIMO_DO_SEGREDO}) não reclama`,
);
ok(
  problemasDeConfiguracao({ NODE_ENV: "production", DOCUMENT_HASH_SECRET: "y".repeat(64) })
    .length === 0,
  "segredo longo não reclama",
);
ok(
  problemasDeConfiguracao({ NODE_ENV: "development" }).length === 0,
  "fora de produção não reclama: o desenvolvimento tem valor padrão",
);
ok(problemasDeConfiguracao({}).length === 0, "sem NODE_ENV não reclama");

console.log("\n--- o aviso do log ---");
ok(avisoParaOLog([]) === null, "sem problema, nada vai para o log");
const linha = avisoParaOLog(curto) || "";
ok(
  linha.startsWith("CONFIGURACAO FALTANDO — "),
  "a linha começa com um prefixo procurável no log do Render",
);
ok(linha.split("\n").length === 1, "uma linha por problema");
ok(!linha.includes(segredoDaJulia), "o valor do segredo NUNCA aparece no log — só o tamanho dele");

console.log("\n--- a trava no cadastro ---");
// Sem segredo válido em produção, gerar hash tem que EXPLODIR, e não cair num
// valor padrão. Um padrão silencioso aqui faria todo mundo compartilhar o
// mesmo hash e a trava do teste grátis viraria ficção.
process.env.NODE_ENV = "production";
delete process.env.DOCUMENT_HASH_SECRET;
const { hashTrialDocument, SegredoDeDocumentoAusente } =
  await import("../src/lib/server/trial-identity.server.ts");
let erro = null;
try {
  hashTrialDocument("12345678000199");
} catch (e) {
  erro = e;
}
ok(
  erro instanceof SegredoDeDocumentoAusente,
  `em produção sem segredo, o hash explode em vez de inventar um padrão (${erro?.name})`,
);

process.env.DOCUMENT_HASH_SECRET = segredoBom;
ok(
  typeof hashTrialDocument("12345678000199") === "string",
  "com segredo válido, o hash volta a funcionar",
);

console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
