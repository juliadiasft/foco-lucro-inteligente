// Monta a lista de pet shops do Brasil inteiro — o outro lado da Central.
//
//   node scripts/coletar-petshops.mjs
//
// CNAE 4789-0/04: comércio varejista de animais vivos e de artigos e alimentos
// para animais de estimação. É o pet shop propriamente dito, o comerciante que
// a Central cobra. São 113.585 no país.
//
// Sai do mesmo lugar que a lista de fornecedores e com os mesmos cuidados, que
// moram em lib/breela.mjs. A diferença é o que se faz com ela: fornecedor a
// gente chama para publicar vitrine de graça; pet shop a gente só chama depois
// que existir vitrine para ele olhar.
//
// PARA QUE ELA SERVE HOJE, antes de existir plataforma cheia: ligar para o pet
// shop e perguntar de quem ele compra. Isso devolve os distribuidores que
// realmente entregam na região dele — não os que a Receita diz que existem — e
// abre a porta com esse distribuidor com uma frase que ligação fria não tem:
// "o pet shop tal me falou de vocês".
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

import { NOME_PET, barrinha, lerCsv, montarCsv, percorrerCnae } from "./lib/breela.mjs";

// O slug vem truncado pela própria Breela — não é o nome completo do CNAE.
// Foi lido da página da divisão 47, não montado a partir da descrição.
const SLUG = "4789004-comercio-varejista-de-animais-vivos-e-de-artigos-e-alimentos-para-animais-de-est";
const PLANILHA = "C:/Users/julia/OneDrive/Desktop/comerciantes-petshop.csv";

const COLUNAS = [
  "Razao social",
  "CNPJ",
  "Cidade",
  "UF",
  "Telefone",
  "Email",
  "Situacao na Receita",
  "Ramo principal",
  "Fornece",
  "Confere na Receita",
  "Nome sugere pet",
  "Status do contato",
  "Data do contato",
  "Quem falou",
  // A coluna que justifica esta planilha existir antes da hora. É a resposta a
  // "de quem você compra?" — e cada resposta aqui vale mais que dez linhas da
  // lista de fornecedores, porque é um distribuidor que comprovadamente
  // entrega naquela cidade.
  "Compra de quem",
  "Resposta",
  "Cadastrou na Central",
  "Observacoes",
];

// A planilha é regravada inteira a cada rodada. Quem já estava dentro mantém
// telefone e anotação de ligação; só entram linhas novas.
let existentes = new Map();
try {
  ({ registros: existentes } = lerCsv(await readFile(PLANILHA, "utf8")));
  console.log(`Planilha atual: ${existentes.size} pet shops. Vou somar sem apagar nada.\n`);
} catch {
  console.log("Planilha nova.\n");
}

console.log("Coletando pet shops do Brasil inteiro (CNAE 4789-0/04).");
console.log("Sao 113 mil e mais de 2.200 paginas — cerca de 40 minutos.\n");

const inicio = Date.now();
const { guardadas, paginas, esperado } = await percorrerCnae(SLUG, {
  aoAndar: ({ guardadas, paginas }) => {
    const min = ((Date.now() - inicio) / 60000).toFixed(0);
    barrinha(`${guardadas.toLocaleString("pt-BR")} pet shops · ${paginas} paginas · ${min} min`);
  },
});

console.log(`\n\n${paginas} paginas lidas, ${esperado.toLocaleString("pt-BR")} esperados.`);

let novas = 0;
for (const [cnpj, empresa] of guardadas) {
  if (existentes.has(cnpj)) continue;
  const registro = Object.fromEntries(COLUNAS.map((c) => [c, ""]));
  registro["Razao social"] = empresa.razaoSocial;
  registro["CNPJ"] = empresa.cnpjFormatado;
  registro["Cidade"] = empresa.cidade;
  registro["UF"] = empresa.uf;
  registro["Fornece"] = "pet shop (comerciante)";
  registro["Nome sugere pet"] = NOME_PET.test(empresa.razaoSocial) ? "sim" : "nao";
  registro["Status do contato"] = "a contatar";
  registro["Cadastrou na Central"] = "nao";
  existentes.set(cnpj, registro);
  novas += 1;
}

const lista = [...existentes.values()].sort(
  (a, b) =>
    (a["UF"] || "").localeCompare(b["UF"] || "") ||
    (a["Cidade"] || "").localeCompare(b["Cidade"] || "") ||
    (a["Razao social"] || "").localeCompare(b["Razao social"] || ""),
);

await writeFile(PLANILHA, montarCsv(COLUNAS, lista), "utf8");

const sugerem = lista.filter((r) => r["Nome sugere pet"] === "sim").length;
console.log(`\n${novas.toLocaleString("pt-BR")} pet shops novos.`);
console.log(`Total: ${lista.length.toLocaleString("pt-BR")}.`);
console.log(
  `${sugerem.toLocaleString("pt-BR")} com nome de pet — os outros ${(lista.length - sugerem).toLocaleString("pt-BR")} tem o CNAE pendurado e podem nao ser pet shop.`,
);

const porUf = {};
for (const r of lista) porUf[r["UF"]] = (porUf[r["UF"]] || 0) + 1;
console.log("\nPor estado:");
for (const [uf, total] of Object.entries(porUf).sort((a, b) => b[1] - a[1]))
  console.log(`  ${uf}  ${total.toLocaleString("pt-BR")}`);

console.log(`\nPlanilha: ${PLANILHA}`);
console.log("Telefone vem depois — e so dos estados ou cidades que voce escolher:");
console.log("  node scripts/enriquecer-telefones.mjs 500 petshops");
process.exit(0);
