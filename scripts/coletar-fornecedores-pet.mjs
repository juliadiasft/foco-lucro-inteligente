// Monta a lista de quem abastece um pet shop no Brasil inteiro.
//
//   node scripts/coletar-fornecedores-pet.mjs
//
// A fonte são os Dados Abertos do CNPJ da Receita Federal, publicados em
// páginas abertas pela Breela.
//
// Pet shop não vive só de ração. Vende coleira, caminha, casinha, brinquedo,
// shampoo, remédio, areia de gato, aquário. Então a lista não pode sair de um
// CNAE só — sai de seis, e cada um responde por uma prateleira da loja.
//
// O QUE A RECEITA NÃO TEM, e é preciso dizer com todas as letras: não existe
// CNAE de "atacado de artigos para pet". Coleira, caminha e casinha não têm
// código próprio. Quem distribui essas coisas se registra no que sobra —
// 4649-4/99 ("outros artigos de uso pessoal e doméstico") ou 4692-3/00
// ("insumos agropecuários") — junto de milhares de empresas que não têm nada a
// ver com pet. Por isso esses dois CNAEs entram com filtro pelo nome da
// empresa, e os outros quatro entram inteiros.
//
// Uma pausa de um segundo entre as páginas, de propósito: são páginas públicas
// de outra empresa, e puxar centenas o mais rápido possível seria abusar de
// quem está servindo de graça.
//
// O que sai daqui é razão social, CNPJ e cidade. Telefone não está na
// listagem: vem depois, pelo enriquecer-telefones.mjs.
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const BASE = "https://breela.com.br/cnae";
const PAUSA_MS = 1000;
const PLANILHA = "C:/Users/julia/OneDrive/Desktop/fornecedores-petshop.csv";

// Empresas cujo nome sugere pet. Usado só nos dois CNAEs genéricos.
//
// Numa amostra de São Paulo o filtro achou "HORSE DOG COMERCIO E CONFECCAO DE
// ACESSORIOS PARA ANIMAIS" no meio de material de construção e importadora de
// trator. É exatamente a distribuidora de coleira que não tem CNAE próprio.
//
// O filtro erra para os dois lados e não tem como não errar: deixa passar
// "FS CASA COMERCIO DE ARTIGOS DE DECORACAO" (o "casa" bate) e perde quem
// distribui acessório com nome de sobrenome de família. Por isso a planilha
// marca de onde veio cada linha — dá para conferir essas antes de ligar.
const NOME_PET =
  /\bPET\b|PETS|ANIMAL|ANIMAIS|VETERIN|RACAO|RAÇÃO|AGROPEC|ZOO|\bCAO\b|CAES|CACHORR|GATO|BICHO|FOCINHO|AUAU|MIAU|CANIL|\bVET\b|AQUAR|PASSARO|AVIARIO/i;

// Os slugs vêm truncados pela própria Breela — não são o nome completo do
// CNAE. Foram lidos das páginas de divisão, não montados a partir da descrição.
const FONTES = [
  {
    cnae: "4623109",
    slug: "4623109-comercio-atacadista-de-alimentos-para-animais",
    fornece: "racao",
    filtrarPeloNome: false,
  },
  {
    cnae: "4644302",
    slug: "4644302-comercio-atacadista-de-medicamentos-e-drogas-de-uso-veterinario",
    fornece: "medicamento veterinario",
    filtrarPeloNome: false,
  },
  {
    cnae: "1066000",
    slug: "1066000-fabricacao-de-alimentos-para-animais",
    fornece: "fabrica de racao",
    filtrarPeloNome: false,
  },
  {
    cnae: "2122000",
    slug: "2122000-fabricacao-de-medicamentos-para-uso-veterinario",
    fornece: "fabrica de medicamento veterinario",
    filtrarPeloNome: false,
  },
  {
    cnae: "4623101",
    slug: "4623101-comercio-atacadista-de-animais-vivos",
    fornece: "animais vivos",
    filtrarPeloNome: false,
  },
  {
    cnae: "4649499",
    slug: "4649499-comercio-atacadista-de-outros-equipamentos-e-artigos-de-uso-pessoal-e-domestico-",
    fornece: "acessorios (coleira, caminha, casinha)",
    filtrarPeloNome: true,
  },
  {
    cnae: "4692300",
    slug: "4692300-comercio-atacadista-de-mercadorias-em-geral-com-predominancia-de-insumos-agropec",
    fornece: "agropecuaria (higiene, areia, acessorio)",
    filtrarPeloNome: true,
  },
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Tenta de novo quando o servidor falha, esperando mais a cada tentativa.
//
// Sem isto, um único HTTP 500 abandonava o estado inteiro: na primeira rodada
// São Paulo travou na página 6 e a planilha ficou com 250 empresas em vez de
// 1.120 — justamente o maior estado. Uma falha passageira não pode custar 870
// contatos.
//
// O 404 não é repetido: significa que a página não existe, e insistir só
// incomoda o servidor.
async function pegar(url, tentativa = 1) {
  const resposta = await fetch(url, {
    headers: {
      "User-Agent":
        "CentralDoComerciante/1.0 (prospeccao propria; +https://central-do-comerciante.onrender.com)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (resposta.ok) return resposta.text();
  if (resposta.status === 404) throw new Error("HTTP 404");
  if (tentativa >= 4) throw new Error(`HTTP ${resposta.status} apos ${tentativa} tentativas`);
  await dormir(2000 * tentativa);
  return pegar(url, tentativa + 1);
}

// Quantas empresas cada estado tem, lido da própria página do CNAE.
//
// Este número é o teto da coleta, e é preciso saber o que ele significa, senão
// a planilha engana.
//
// A listagem da Breela traz duas coisas misturadas: as empresas que têm o CNAE
// como atividade PRINCIPAL e as que só o têm pendurado como secundário. O
// contador da página conta só as primeiras. Conferindo CNPJ por CNPJ na
// Receita: o Pará declara 106 fábricas de ração e a listagem entrega mais de
// 3.000 — todas do Pará, todas com o CNAE de verdade, mas a maioria como
// atividade secundária. Nas páginas do fundo aparecem "CABANAS RESTAURANTE",
// "ROMA SUPERMERCADO", "MINAS AUTO PECAS". São empresas reais com o código no
// cadastro, e nenhuma delas abastece pet shop.
//
// Não existe filtro de atividade principal no site, e a listagem não vem
// ordenada por isso. Então parar no contador é o que mantém a proporção de
// distribuidora de verdade alta — não por ser um corte exato, mas porque ir
// além só acrescenta secundário. Quem cruza a linha certa é a coluna "Confere
// na Receita", preenchida depois, uma consulta por empresa.
async function contagemPorEstado(slug) {
  const html = await pegar(`${BASE}/${slug}`);
  const re =
    /href="\/cnae\/[^"]*\/([a-z]{2})"[^>]*>[^<]*(?:<!--[^>]*-->)?[^(]*\(<!--[^>]*-->(\d[\d.]*)/g;
  const contagem = {};
  let achado;
  while ((achado = re.exec(html)) !== null) {
    contagem[achado[1]] = Number(achado[2].replace(/\./g, ""));
  }
  return contagem;
}

// Cada empresa é um <li> com link para /cnpj/<14 dígitos>-<slug>, a razão
// social dentro do link, e o CNPJ formatado com a cidade num div ao lado. Os
// comentários <!-- --> no meio vêm do React e precisam ser tolerados.
function extrair(html) {
  const encontrados = [];
  const bloco =
    /<a class="result-title" href="\/cnpj\/(\d{14})[^"]*">([\s\S]*?)<\/a>\s*<div class="result-meta">\s*([\d./-]{18})(?:<!--\s*-->)?\s*·\s*([^</]+?)\/([A-Z]{2})\s*<\/div>/g;
  let achado;
  while ((achado = bloco.exec(html)) !== null) {
    const razao = achado[2]
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (!razao) continue;
    encontrados.push({
      cnpj: achado[1],
      cnpjFormatado: achado[3],
      razaoSocial: razao,
      cidade: achado[4].trim(),
      uf: achado[5],
    });
  }
  return encontrados;
}

// --- Planilha ---

const COLUNAS = [
  "Razao social",
  "CNPJ",
  "Cidade",
  "UF",
  "Telefone",
  "Email",
  "Situacao na Receita",
  "Ramo principal",
  // "Fornece" sai da coleta: e o CNAE pelo qual a empresa foi encontrada, e
  // diz qual prateleira do pet shop ela abastece. Uma empresa pode aparecer em
  // mais de um CNAE — ai os dois ficam, separados por "; ".
  "Fornece",
  // "Confere na Receita" sai do enriquecimento, e e outra pergunta: aquilo que
  // ela fornece e a atividade PRINCIPAL dela, ou so um CNAE secundario? As
  // duas colunas juntas dizem se vale a ligacao.
  "Confere na Receita",
  // O unico sinal que da para ler de graca, sem gastar consulta: o nome.
  // "DISTRIBUIDORA DE RACOES" abastece pet shop; "CABANAS RESTAURANTE" tem o
  // CNAE pendurado. Nao serve para decidir nada sozinho — erra dos dois lados,
  // e uma distribuidora com nome de sobrenome de familia cai no "nao". Serve
  // para ordenar o trabalho caro: o enriquecimento comeca por quem tem "sim",
  // entao as primeiras horas de consulta rendem muito mais contato util.
  "Nome sugere pet",
  "Status do contato",
  "Data do contato",
  "Quem falou",
  "Resposta",
  "Cadastrou na Central",
  "Publicou vitrine",
  "Itens no catalogo",
  "Observacoes",
];

// Divide respeitando aspas: razão social tem vírgula com frequência
// ("SERQUIMICA INDUSTRIA, COMERCIO..."), e um split simples quebraria a linha.
function separarLinha(linha) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else dentroDeAspas = !dentroDeAspas;
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos;
}

const escapar = (valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// Lê a planilha que já existe e devolve cada linha como objeto, indexada por
// CNPJ.
//
// Isto é o coração da rodada: quando a Julia rodou este script pela primeira
// vez a planilha ainda não existia. Agora ela tem telefone de centenas de
// empresas e, em breve, "liguei em tal dia, falei com fulano". Sobrescrever
// apagaria tudo isso. Então o script lê, funde e regrava — quem já estava
// dentro mantém cada coluna preenchida à mão, e só ganha o "Fornece" novo.
async function lerPlanilha() {
  let bruto;
  try {
    bruto = await readFile(PLANILHA, "utf8");
  } catch {
    return { existentes: new Map(), antigas: 0 };
  }
  const linhas = bruto
    .replace(/^\ufeff/, "")
    .trim()
    .split(/\r?\n/);
  if (linhas.length < 2) return { existentes: new Map(), antigas: 0 };

  const cabecalho = separarLinha(linhas[0]);
  const existentes = new Map();
  for (const linha of linhas.slice(1)) {
    const campos = separarLinha(linha);
    const registro = {};
    cabecalho.forEach((coluna, i) => {
      registro[coluna] = campos[i] ?? "";
    });
    // A planilha antiga chamava esta coluna de "Atacado de racao" e guardava
    // principal/secundario/nao tem. É a mesma pergunta com outro nome, agora
    // que a lista deixou de ser só de ração.
    if (registro["Atacado de racao"] && !registro["Confere na Receita"]) {
      registro["Confere na Receita"] = registro["Atacado de racao"];
    }
    // Todo mundo que já estava na planilha veio do CNAE de ração.
    if (!registro["Fornece"]) registro["Fornece"] = "racao";
    if (!registro["Nome sugere pet"])
      registro["Nome sugere pet"] = NOME_PET.test(registro["Razao social"] || "") ? "sim" : "nao";
    const chave = soDigitos(registro["CNPJ"]);
    if (chave.length === 14) existentes.set(chave, registro);
  }
  return { existentes, antigas: existentes.size };
}

// --- Coleta ---

const { existentes, antigas } = await lerPlanilha();
console.log(
  antigas
    ? `Planilha atual: ${antigas} empresas. Vou somar as novas sem apagar nada.\n`
    : "Planilha nova.\n",
);

const novas = new Map();
let paginasLidas = 0;
const resumo = [];

for (const fonte of FONTES) {
  let contagem;
  try {
    contagem = await contagemPorEstado(fonte.slug);
  } catch (erro) {
    console.log(`${fonte.cnae}: nao consegui ler a contagem (${erro.message}) — pulando`);
    continue;
  }
  const ufs = Object.keys(contagem);
  const esperado = Object.values(contagem).reduce((a, b) => a + b, 0);
  if (!ufs.length) {
    console.log(`${fonte.cnae}: pagina mudou de formato — pulando`);
    continue;
  }

  console.log(
    `${fonte.cnae} — ${fonte.fornece}: ${esperado} empresas em ${ufs.length} estados` +
      (fonte.filtrarPeloNome ? " (so as com nome de pet)" : ""),
  );

  let doCnae = 0;
  let descartadas = 0;

  for (const uf of ufs) {
    const maximoDePaginas = Math.ceil(contagem[uf] / 50);
    for (let pagina = 1; pagina <= maximoDePaginas; pagina += 1) {
      const url =
        pagina === 1
          ? `${BASE}/${fonte.slug}/${uf}`
          : `${BASE}/${fonte.slug}/${uf}/pagina-${pagina}`;
      let html;
      try {
        html = await pegar(url);
      } catch (erro) {
        console.log(`\n  ${uf.toUpperCase()} pag.${pagina}: ${erro.message} — parando neste estado`);
        break;
      }
      paginasLidas += 1;
      const linhas = extrair(html);
      if (!linhas.length) break;

      for (const empresa of linhas) {
        if (fonte.filtrarPeloNome && !NOME_PET.test(empresa.razaoSocial)) {
          descartadas += 1;
          continue;
        }
        doCnae += 1;
        // A mesma distribuidora aparece em mais de um CNAE com frequência:
        // quem vende ração no atacado costuma vender remédio veterinário
        // também. Não é linha duplicada, é uma empresa que abastece duas
        // prateleiras — e isso é informação para quem vai ligar, não ruído.
        const jaVista = novas.get(empresa.cnpj);
        if (jaVista) {
          if (!jaVista.fornece.includes(fonte.fornece)) jaVista.fornece.push(fonte.fornece);
        } else {
          novas.set(empresa.cnpj, { ...empresa, fornece: [fonte.fornece] });
        }
      }

      process.stdout.write(
        `\r  ${doCnae} guardadas · ${descartadas} fora do nicho · ${paginasLidas} paginas   `,
      );
      // Última página do estado: veio incompleta.
      if (linhas.length < 50) break;
      await dormir(PAUSA_MS);
    }
  }
  console.log("");
  resumo.push({ cnae: fonte.cnae, fornece: fonte.fornece, guardadas: doCnae, descartadas });
}

// --- Fusão ---

let acrescentadas = 0;
let ampliadas = 0;

for (const [cnpj, nova] of novas) {
  const antiga = existentes.get(cnpj);
  if (antiga) {
    // Já estava na planilha: preserva telefone, anotações e tudo mais. Só
    // acrescenta a prateleira nova, se for nova mesmo.
    const jaTem = (antiga["Fornece"] || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const somadas = [...new Set([...jaTem, ...nova.fornece])];
    if (somadas.length > jaTem.length) {
      antiga["Fornece"] = somadas.join("; ");
      ampliadas += 1;
    }
  } else {
    const registro = Object.fromEntries(COLUNAS.map((c) => [c, ""]));
    registro["Razao social"] = nova.razaoSocial;
    registro["CNPJ"] = nova.cnpjFormatado;
    registro["Cidade"] = nova.cidade;
    registro["UF"] = nova.uf;
    registro["Fornece"] = nova.fornece.join("; ");
    registro["Nome sugere pet"] = NOME_PET.test(nova.razaoSocial) ? "sim" : "nao";
    registro["Status do contato"] = "a contatar";
    registro["Cadastrou na Central"] = "nao";
    registro["Publicou vitrine"] = "nao";
    existentes.set(cnpj, registro);
    acrescentadas += 1;
  }
}

const lista = [...existentes.values()].sort(
  (a, b) =>
    (a["UF"] || "").localeCompare(b["UF"] || "") ||
    (a["Cidade"] || "").localeCompare(b["Cidade"] || "") ||
    (a["Razao social"] || "").localeCompare(b["Razao social"] || ""),
);

const csv = [
  COLUNAS.map(escapar).join(","),
  ...lista.map((r) => COLUNAS.map((c) => escapar(r[c])).join(",")),
];

// BOM no início: sem ele o Excel em português abre os acentos errados.
await writeFile(PLANILHA, "\ufeff" + csv.join("\r\n") + "\r\n", "utf8");

// --- Relatório ---

console.log(`\n${paginasLidas} paginas lidas.\n`);
console.log("Por prateleira:");
for (const r of resumo) {
  const fora = r.descartadas ? ` (${r.descartadas} descartadas pelo nome)` : "";
  console.log(`  ${String(r.guardadas).padStart(5)}  ${r.cnae}  ${r.fornece}${fora}`);
}

console.log(`\n${acrescentadas} empresas novas na planilha.`);
if (ampliadas) console.log(`${ampliadas} que ja estavam ganharam prateleira nova.`);
console.log(`Total agora: ${lista.length} empresas.`);

const sugerem = lista.filter((r) => r["Nome sugere pet"] === "sim").length;
console.log(`${sugerem} tem nome de pet — sao essas que o enriquecimento consulta primeiro.`);

const comTelefone = lista.filter((r) => r["Telefone"]?.trim()).length;
console.log(`${comTelefone} ja tem telefone — as outras esperam o enriquecer-telefones.`);

const porUf = {};
for (const r of lista) porUf[r["UF"]] = (porUf[r["UF"]] || 0) + 1;
console.log("\nPor estado:");
for (const [uf, total] of Object.entries(porUf).sort((a, b) => b[1] - a[1]))
  console.log(`  ${uf}  ${total}`);

console.log(`\nPlanilha: ${PLANILHA}`);
process.exit(0);
