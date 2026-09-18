// Testa a escolha de tema claro/escuro.
//
//   node scripts/tema.test.mjs
//
// O CSS dos dois temas existia desde o começo em src/styles.css, completo, e
// nunca funcionou: nenhuma linha do sistema escrevia a classe `dark` no
// <html>. Era código morto — quem preferia escuro via o app claro e pronto.
//
// São três estados e não dois, e é aí que mora o erro fácil: tratar "sistema"
// como se fosse "claro" faz o app brilhar na cara de quem está deitado com o
// celular no modo noturno.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { ficaEscuro, ehTema, TEMAS, TEMA_PADRAO, CHAVE_DO_TEMA, SCRIPT_DO_TEMA, NOME_DO_TEMA } =
  await import("../src/lib/tema.ts");

console.log("--- a escolha explícita manda, sempre ---");
ok(ficaEscuro("escuro", false) === true, "escolheu escuro, o sistema diz claro: fica escuro");
ok(ficaEscuro("claro", true) === false, "escolheu claro, o sistema diz escuro: fica claro");

console.log("\n--- sem escolha, o aparelho decide ---");
ok(ficaEscuro("sistema", true) === true, "sistema no modo noturno: fica escuro");
ok(ficaEscuro("sistema", false) === false, "sistema no modo claro: fica claro");
ok(
  TEMA_PADRAO === "sistema",
  `o padrão é seguir o aparelho (${TEMA_PADRAO}) — e não forçar claro em quem está no escuro`,
);

console.log("\n--- o que vem guardado pode ser lixo ---");
// O valor vem do navegador: pode ter sido editado à mão, ter sobrado de uma
// versão antiga, ou simplesmente não existir.
ok(!ehTema(null), "nada guardado não é tema");
ok(!ehTema("dark"), "valor em inglês de outra versão não é aceito");
ok(!ehTema(""), "texto vazio não é tema");
ok(!ehTema("DARK"), "maiúsculas não passam");
for (const tema of TEMAS) ok(ehTema(tema), `"${tema}" é tema válido`);

console.log("\n--- o script que roda antes da tela pintar ---");
ok(
  SCRIPT_DO_TEMA.includes(JSON.stringify(CHAVE_DO_TEMA)),
  "o script lê a MESMA chave que a tela grava — se divergirem, a escolha some ao recarregar",
);
ok(SCRIPT_DO_TEMA.includes("try{"), "erro de armazenamento não derruba a página");
ok(
  SCRIPT_DO_TEMA.includes("prefers-color-scheme"),
  "o script também consulta o aparelho, senão o padrão nunca ficaria escuro",
);
// Este script é injetado como HTML cru no <head>. Um "</script>" dentro dele
// fecharia a tag mais cedo e despejaria o resto como texto na página.
ok(
  !/<\/script/i.test(SCRIPT_DO_TEMA),
  "o script não contém nada que feche a própria tag antes da hora",
);

// Roda o script de verdade contra um documento de mentira, para não confiar em
// leitura de texto: é ele que decide a primeira pintura da tela.
for (const [guardado, sistemaEscuro, esperado] of [
  ["escuro", false, true],
  ["claro", true, false],
  ["sistema", true, true],
  ["sistema", false, false],
  [null, true, true],
  ["qualquer coisa", true, false],
]) {
  const classes = new Set();
  const documentoFalso = {
    documentElement: {
      classList: { toggle: (nome, ligar) => (ligar ? classes.add(nome) : classes.delete(nome)) },
      style: {},
    },
  };
  const janelaFalsa = { matchMedia: () => ({ matches: sistemaEscuro }) };
  const armazenamentoFalso = { getItem: () => guardado };
  new Function("document", "window", "localStorage", SCRIPT_DO_TEMA)(
    documentoFalso,
    janelaFalsa,
    armazenamentoFalso,
  );
  ok(
    classes.has("dark") === esperado,
    `guardado ${JSON.stringify(guardado)} + aparelho ${sistemaEscuro ? "escuro" : "claro"} → ${esperado ? "escuro" : "claro"}`,
  );
}

console.log("\n--- os nomes que a pessoa lê ---");
// Um comerciante de bairro não sabe o que é "system". Os rótulos são parte da
// regra, não enfeite: se voltarem para o inglês, a tela fica incompreensível.
for (const tema of TEMAS) {
  ok(
    typeof NOME_DO_TEMA[tema] === "string" && NOME_DO_TEMA[tema].length > 0,
    `"${tema}" tem nome em português: ${NOME_DO_TEMA[tema]}`,
  );
}

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
