// Testa o miolo do painel sem abrir navegador.
//
//   node scripts/painel.test.mjs
//
// O painel é um HTML de vários megabytes que o navegador da ferramenta se
// recusa a abrir. Mas o que pode dar errado nele não é o desenho: é a conta
// dos filtros e o link do WhatsApp. Um filtro que conta errado faz a Julia
// achar que tem 300 contatos quando tem 30. Um link torto abre conversa com o
// número errado — pior ainda, porque parece que funcionou.
//
// Então o teste arranca o <script> do HTML gerado, roda num DOM de mentira e
// pergunta as coisas que importam.
import { readFile } from "node:fs/promises";
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const ARQUIVO =
  process.argv[2] === "petshops"
    ? "C:/Users/julia/OneDrive/Desktop/painel-comerciantes.html"
    : "C:/Users/julia/OneDrive/Desktop/painel-fornecedores.html";
const html = await readFile(ARQUIVO, "utf8");
const script = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));

// DOM de mentira: só o suficiente para o script rodar. Cada elemento guarda
// value e innerHTML, e engole os eventos.
function elementoFalso(id) {
  return {
    id,
    value: "",
    innerHTML: "",
    textContent: "",
    disabled: false,
    dataset: {},
    href: "",
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    closest: () => null,
    set onclick(_) {},
  };
}
const elementos = new Map();
const doc = {
  getElementById: (id) => {
    if (!elementos.has(id)) elementos.set(id, elementoFalso(id));
    return elementos.get(id);
  },
  createElement: () => elementoFalso("novo"),
  querySelectorAll: () => [],
};

// localStorage de mentira. Sem ele o script do quadro caía no catch e o teste
// passava sem ter exercitado nada — e o quadro é justamente a parte que grava
// o trabalho do dia dela.
const guardado = new Map();
const contexto = {
  document: doc,
  navigator: { clipboard: { writeText() {} } },
  setTimeout,
  Blob: class {},
  URL: { createObjectURL: () => "", revokeObjectURL() {} },
  encodeURIComponent,
  localStorage: {
    getItem: (k) => guardado.get(k) ?? null,
    setItem: (k, v) => guardado.set(k, String(v)),
    removeItem: (k) => guardado.delete(k),
  },
  confirm: () => true,
};

// Roda o script do painel e devolve o que ele definiu por dentro.
const rodar = new Function(
  ...Object.keys(contexto),
  script +
    "\n; return { LINHAS, filtros, filtrar, linkZap, linkEmail, mensagemPara, ordenar," +
    " MODELO_PADRAO, ASSUNTO_PADRAO, RAZAO, CIDADE, UF, TEL, EMAIL, ZAP, CONFERE," +
    " SUGERE, ATIVA, STATUS, FORNECE, MATRIZ, QUANTOS, ETAPAS, etapaDe, movidos," +
    " guardarMovidos, CHAVE };",
);
const p = rodar(...Object.values(contexto));

console.log(`--- ${p.LINHAS.length} empresas carregadas ---\n`);

console.log("--- o filtro conta o que existe ---");
const tudo = p.filtrar().length;
ok(tudo === p.LINHAS.length, `sem filtro devolve a lista inteira (${tudo})`);

p.filtros.uf = "SP";
const sp = p.filtrar();
const spReal = p.LINHAS.filter((l) => l[p.UF] === "SP").length;
ok(sp.length === spReal && sp.length > 0, `filtro de estado bate com a contagem real (SP: ${sp.length})`);
ok(
  sp.every((l) => l[p.UF] === "SP"),
  "nenhuma empresa de outro estado escapa pelo filtro de SP",
);

p.filtros.uf = "";
p.filtros.contato = "zap";
const comZap = p.filtrar();
ok(
  comZap.length > 0 && comZap.every((l) => l[p.ZAP]),
  `"tem WhatsApp" devolve só quem tem (${comZap.length})`,
);

p.filtros.contato = "sem";
ok(
  p.filtrar().every((l) => !l[p.TEL]),
  '"sem telefone ainda" devolve só quem está sem',
);

p.filtros.contato = "";
p.filtros.confere = "pendente";
const pendentes = p.filtrar();
ok(
  pendentes.every((l) => !l[p.CONFERE]),
  `"ainda não conferido" não deixa passar quem já foi (${pendentes.length})`,
);

p.filtros.confere = "principal";
const principais = p.filtrar();
ok(
  principais.length > 0 && principais.every((l) => l[p.CONFERE] === "principal"),
  `"só atividade principal" devolve só principal (${principais.length})`,
);

console.log("\n--- dois filtros juntos apertam, não afrouxam ---");
p.filtros.uf = "SP";
const doisJuntos = p.filtrar().length;
ok(
  doisJuntos <= principais.length && doisJuntos <= spReal,
  `estado + atividade principal (${doisJuntos}) nunca é maior que cada um sozinho`,
);

console.log("\n--- a busca acha ---");
Object.keys(p.filtros).forEach((k) => (p.filtros[k] = ""));
const alguma = p.LINHAS.find((l) => l[p.RAZAO].length > 12);
p.filtros.busca = alguma[p.RAZAO].slice(0, 12);
const achou = p.filtrar();
ok(
  achou.some((l) => l[p.RAZAO] === alguma[p.RAZAO]),
  `buscar por "${p.filtros.busca}" encontra a empresa`,
);

console.log("\n--- a mensagem é personalizada de verdade ---");
Object.keys(p.filtros).forEach((k) => (p.filtros[k] = ""));
const comZapAgora = p.LINHAS.filter((l) => l[p.ZAP]);
ok(comZapAgora.length > 0, `${comZapAgora.length} empresas com WhatsApp para testar`);
const alvo = comZapAgora[0];
const msg = p.mensagemPara(alvo);
ok(msg.includes(alvo[p.RAZAO]), "o nome da empresa entra no texto");
ok(!msg.includes("{empresa}"), "não sobra {empresa} sem trocar");
ok(!msg.includes("{cidade}"), "não sobra {cidade} sem trocar");

console.log("\n--- o link do WhatsApp está montado certo ---");
const link = p.linkZap(alvo);
ok(link.startsWith("https://wa.me/55"), "começa com wa.me e o código do Brasil");
const numeroNoLink = link.slice(16, link.indexOf("?"));
ok(numeroNoLink === alvo[p.ZAP], `o número do link é o da empresa (${numeroNoLink})`);
ok(numeroNoLink.length === 11, "o número tem 11 dígitos — com o nono na frente");
ok(numeroNoLink[2] === "9", "o terceiro dígito é 9, como todo celular brasileiro");
ok(
  decodeURIComponent(link.split("?text=")[1]).includes(alvo[p.RAZAO]),
  "a mensagem viaja dentro do link, e volta legível",
);

console.log("\n--- o botão de e-mail ---");
// O assunto do e-mail é declarado no fim do script e usado por uma função
// definida antes dele. Isso funciona só porque a função roda depois, no clique.
// Se alguém mover a chamada para cima, quebra com "Cannot access before
// initialization" e o botão simplesmente para de abrir o e-mail — sem erro
// visível na tela. Este teste é o alarme.
const comEmail = p.LINHAS.filter((l) => l[p.EMAIL]);
ok(comEmail.length > 0, `${comEmail.length.toLocaleString("pt-BR")} empresas com e-mail`);
const alvoEmail = comEmail[0];
let linkE = "";
let erroE = null;
try {
  linkE = p.linkEmail(alvoEmail);
} catch (erro) {
  erroE = erro.message;
}
ok(!erroE, `monta o link sem estourar${erroE ? ": " + erroE : ""}`);
ok(linkE.startsWith("mailto:" + alvoEmail[p.EMAIL]), "vai para o e-mail da empresa");
const assunto = decodeURIComponent((linkE.match(/subject=([^&]*)/) || [])[1] || "");
ok(assunto.includes(alvoEmail[p.RAZAO]), `o assunto traz o nome da empresa`);
ok(!assunto.includes("{empresa}"), "não sobra {empresa} no assunto");
const corpo = decodeURIComponent((linkE.match(/body=(.*)$/) || [])[1] || "");
ok(corpo.includes(alvoEmail[p.RAZAO]), "o corpo é o mesmo texto personalizado");

console.log("\n--- ninguém sem WhatsApp ganha botão de WhatsApp ---");
// O ZAP só é preenchido para celular. Um fixo virando link de WhatsApp abriria
// conversa com um número que não existe, e a Julia só descobriria no meio da
// prospecção.
const fixos = p.LINHAS.filter((l) => l[p.TEL] && !l[p.ZAP]);
ok(fixos.length > 0, `${fixos.length} empresas com telefone fixo`);
ok(
  fixos.every((l) => {
    const d = l[p.TEL].replace(/\D/g, "");
    return !(d.length === 11 && d[2] === "9");
  }),
  "nenhum celular ficou de fora do WhatsApp por engano",
);
const zaps = p.LINHAS.filter((l) => l[p.ZAP]);
ok(
  zaps.every((l) => l[p.ZAP].length === 11 && l[p.ZAP][2] === "9"),
  "todo número marcado como WhatsApp é celular de 11 dígitos",
);

console.log("\n--- a fila começa por quem vale mais ---");
const fila = p.ordenar(p.LINHAS.filter((l) => l[p.TEL] && l[p.ATIVA] !== 0));
ok(fila.length > 0, `${fila.length} na fila de contato`);
const primeiroSemZap = fila.findIndex((l) => !l[p.ZAP]);
const ultimoComZap = fila.map((l) => !!l[p.ZAP]).lastIndexOf(true);
ok(
  primeiroSemZap === -1 || ultimoComZap < primeiroSemZap,
  "quem tem WhatsApp vem antes de quem só tem fixo",
);

console.log("\n--- o quadro e o filtro de matriz ---");
ok(p.ETAPAS.length === 5, `cinco etapas: ${p.ETAPAS.map((e) => e.nome).join(" → ")}`);
ok(
  p.ETAPAS[0].id === "a contatar",
  'a primeira etapa é "a contatar", o mesmo texto que a planilha usa',
);

// Uma empresa que ainda não foi mexida cai na etapa que está na planilha.
const qualquer = p.LINHAS[0];
ok(p.etapaDe(qualquer) === (qualquer[p.STATUS] || "a contatar"), "sem mover, a etapa vem da planilha");

// Mover é o que o arraste faz por dentro: grava o CNPJ e a etapa nova.
p.movidos[qualquer[p.CNPJ] ?? qualquer[13]] = "contatado";
p.guardarMovidos();
ok(p.etapaDe(qualquer) === "contatado", "depois de mover, a etapa nova vale");
ok(guardado.has(p.CHAVE), `o que ela move fica guardado no navegador (chave "${p.CHAVE}")`);
ok(
  JSON.parse(guardado.get(p.CHAVE))[qualquer[13]] === "contatado",
  "e o que está guardado é a etapa certa, não outra coisa",
);
// A chave leva o nome da lista: os dois painéis não podem se atropelar.
ok(/fornecedores|petshops/.test(p.CHAVE), "a chave separa os dois painéis");

// O filtro que tira as filiais — a Petz tem 365 unidades no mesmo telefone.
const filiais = p.LINHAS.filter((l) => l[p.MATRIZ] === "filial");
Object.keys(p.filtros).forEach((k) => (p.filtros[k] = ""));
p.filtros.matriz = "decide";
const decidem = p.filtrar();
ok(
  decidem.every((l) => l[p.MATRIZ] !== "filial"),
  `"quem decide" tira as ${filiais.length.toLocaleString("pt-BR")} filiais`,
);
p.filtros.matriz = "filial";
ok(
  p.filtrar().every((l) => l[p.MATRIZ] === "filial"),
  "e dá para ver só as filiais quando ela quiser",
);
Object.keys(p.filtros).forEach((k) => (p.filtros[k] = ""));

await Promise.resolve();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
