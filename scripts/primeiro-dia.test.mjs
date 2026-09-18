// Testa o painel do primeiro dia do fornecedor.
//
//   node scripts/primeiro-dia.test.mjs
//
// Hoje quem acaba de se cadastrar abre o painel e lê três vazios em sequência:
// "nenhum cliente esperando agora", "nenhum nicho escolhido", "ainda não há
// avaliações". Quem chegou há um minuto lê isso como "não tem nada aqui" e
// fecha — e quem perde é a Julia, que trouxe essa pessoa no telefone.
//
// Este arquivo testa a lógica pura: quais passos aparecem, em que ordem, e a
// frase da chamada de topo. Nada aqui toca banco — é por isso que pode ser
// testado sem subir servidor.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { passosDoFornecedor, ehPrimeiroDia, chamadaDaRegiao } =
  await import("../src/lib/primeiro-dia.ts");

const vazio = {
  itensNoCatalogo: 0,
  temNicho: false,
  vitrinePublicada: false,
  prazoDeEntrega: null,
};

console.log("--- fornecedor recém-cadastrado: nada feito ---");
const passosVazio = passosDoFornecedor(vazio);
ok(passosVazio.length === 4, `quatro passos (${passosVazio.length})`);
ok(
  passosVazio.every((p) => !p.feito),
  "nenhum passo marcado como feito",
);
ok(
  passosVazio[0].chave === "catalogo",
  `catálogo vem primeiro (${passosVazio[0].chave}) — sem preço, nada mais importa`,
);
ok(
  passosVazio.every((p) => p.porque && p.porque.length > 0),
  "todo passo carrega o motivo em texto, nunca fica mudo",
);
ok(
  !passosVazio[0].porque.toLowerCase().includes("complete seu perfil"),
  "o motivo é concreto, não a frase genérica que a Julia rejeitou",
);

console.log("\n--- o motivo muda quando o passo já está feito ---");
const comCatalogo = passosDoFornecedor({ ...vazio, itensNoCatalogo: 12 });
ok(comCatalogo[0].feito === true, "catálogo marcado como feito com 12 itens");
ok(
  comCatalogo[0].porque.includes("12"),
  `o motivo passa a contar o que já existe (${comCatalogo[0].porque})`,
);

console.log("\n--- singular e plural ---");
const umItem = passosDoFornecedor({ ...vazio, itensNoCatalogo: 1 });
ok(umItem[0].porque.includes("1 item ") || umItem[0].porque.endsWith("1 item"), "1 item, singular");
ok(comCatalogo[0].porque.includes("12 itens"), "12 itens, plural");

console.log("\n--- é primeiro dia até estar de fato encontrável ---");
ok(ehPrimeiroDia(vazio) === true, "nada feito: é primeiro dia");
ok(
  ehPrimeiroDia({
    itensNoCatalogo: 5,
    temNicho: true,
    vitrinePublicada: false,
    prazoDeEntrega: 3,
  }) === true,
  "catálogo cheio mas vitrine fora do ar: ainda é primeiro dia — ninguém o encontra",
);
ok(
  ehPrimeiroDia({
    itensNoCatalogo: 0,
    temNicho: true,
    vitrinePublicada: true,
    prazoDeEntrega: 3,
  }) === true,
  "vitrine publicada mas sem item: ainda é primeiro dia — a vitrine está vazia",
);
ok(
  ehPrimeiroDia({
    itensNoCatalogo: 5,
    temNicho: true,
    vitrinePublicada: true,
    prazoDeEntrega: 3,
  }) === false,
  "catálogo com itens e vitrine no ar: primeiro dia acabou, painel normal assume",
);

console.log("\n--- a chamada da região não inventa demanda ---");
ok(
  chamadaDaRegiao(0, false, "Campinas/SP") === null,
  "zero buscas registradas: nenhuma frase aparece, nunca '0 buscas' em destaque",
);
ok(chamadaDaRegiao(-1, false, null) === null, "número negativo também não vira frase");

console.log("\n--- a chamada quando existe procura real ---");
const semAparecer = chamadaDaRegiao(14, false, "Campinas/SP");
ok(semAparecer !== null, "com buscas, a frase existe");
ok(semAparecer.includes("14"), `carrega o número (${semAparecer})`);
ok(semAparecer.includes("Campinas/SP"), "carrega a região");
ok(
  semAparecer.toLowerCase().includes("não apareceu"),
  "diz explicitamente que ele não apareceu — é o gancho que vende a tarefa",
);

const aparecendo = chamadaDaRegiao(14, true, "Campinas/SP");
ok(
  !aparecendo.toLowerCase().includes("não apareceu"),
  "quem já aparece não lê que está perdendo nada",
);
ok(
  aparecendo.toLowerCase().includes("mantenha"),
  "quem já aparece lê o que fazer para continuar aparecendo",
);

console.log("\n--- singular de busca ---");
const umaBusca = chamadaDaRegiao(1, false, null);
ok(umaBusca.startsWith("1 busca "), `"1 busca", não "1 buscas" (${umaBusca})`);

console.log("\n--- sem região conhecida ---");
const semRegiao = chamadaDaRegiao(5, false, null);
ok(!semRegiao.includes("null"), "ausência de região nunca vaza como texto 'null' na tela");
ok(semRegiao.includes("5"), "o número continua aparecendo mesmo sem região");

console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
