// O que os coletores de fornecedor e de pet shop têm em comum.
//
// As duas listas saem do mesmo lugar — as páginas por CNAE que a Breela
// publica a partir dos Dados Abertos da Receita — e tropeçam nas mesmas
// pedras: comentários do React no meio do HTML, servidor que devolve 500 de
// vez em quando, e um contador que não conta o que parece contar.
//
// Estava tudo duplicado em dois arquivos. Duplicado significa que uma correção
// aplicada num deles não chega no outro, e o segundo continua errando em
// silêncio. Aqui é um lugar só.
import process from "node:process";

export const BASE = "https://breela.com.br/cnae";
export const PAUSA_MS = 1000;

const USER_AGENT =
  "CentralDoComerciante/1.0 (prospeccao propria; +https://central-do-comerciante.onrender.com)";

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Tenta de novo quando o servidor falha, esperando mais a cada tentativa.
//
// Sem isto, um único HTTP 500 abandonava o estado inteiro: na primeira rodada
// São Paulo travou na página 6 e a planilha ficou com 250 empresas em vez de
// 1.120 — justamente o maior estado. Uma falha passageira não pode custar 870
// contatos.
//
// O 404 não é repetido: significa que a página não existe, e insistir só
// incomoda o servidor. É também assim que a paginação termina — a lista de um
// estado acaba quando a próxima página devolve 404.
export async function pegar(url, tentativa = 1) {
  const resposta = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
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
// A listagem traz duas coisas misturadas: as empresas que têm o CNAE como
// atividade PRINCIPAL e as que só o têm pendurado como secundário. O contador
// conta só as primeiras. Conferindo CNPJ por CNPJ na Receita: o Pará declara
// 106 fábricas de ração e a listagem entrega mais de 3.000 — todas do Pará,
// todas com o CNAE de verdade, mas a maioria como atividade secundária. Nas
// páginas do fundo aparecem "CABANAS RESTAURANTE" e "MINAS AUTO PECAS".
//
// Não existe filtro de atividade principal no site, e a listagem não vem
// ordenada por isso. Parar no contador é o que mantém alta a proporção de
// empresa certa — não por ser um corte exato, mas porque ir além só
// acrescenta secundário.
export async function contagemPorEstado(slug) {
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
export function extrair(html) {
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

// Percorre um CNAE inteiro, estado por estado, respeitando o teto de cada um.
//
// `aceitar` decide se a empresa entra; `aoAndar` recebe o progresso para o
// script poder desenhar a barrinha do seu jeito.
export async function percorrerCnae(slug, { aceitar = () => true, aoAndar } = {}) {
  const contagem = await contagemPorEstado(slug);
  const ufs = Object.keys(contagem);
  if (!ufs.length) throw new Error("nao consegui ler a contagem por estado");

  const guardadas = new Map();
  let descartadas = 0;
  let paginas = 0;

  for (const uf of ufs) {
    const maximoDePaginas = Math.ceil(contagem[uf] / 50);
    for (let pagina = 1; pagina <= maximoDePaginas; pagina += 1) {
      const url = pagina === 1 ? `${BASE}/${slug}/${uf}` : `${BASE}/${slug}/${uf}/pagina-${pagina}`;
      let html;
      try {
        html = await pegar(url);
      } catch (erro) {
        if (erro.message !== "HTTP 404")
          console.log(`\n  ${uf.toUpperCase()} pag.${pagina}: ${erro.message} — parando neste estado`);
        break;
      }
      paginas += 1;
      const linhas = extrair(html);
      if (!linhas.length) break;
      for (const empresa of linhas) {
        if (aceitar(empresa)) guardadas.set(empresa.cnpj, empresa);
        else descartadas += 1;
      }
      if (aoAndar) aoAndar({ guardadas: guardadas.size, descartadas, paginas, uf });
      // Última página do estado: veio incompleta.
      if (linhas.length < 50) break;
      await dormir(PAUSA_MS);
    }
  }
  return { guardadas, descartadas, paginas, esperado: Object.values(contagem).reduce((a, b) => a + b, 0) };
}

// --- CSV ---

// Divide respeitando aspas: razão social tem vírgula com frequência
// ("SERQUIMICA INDUSTRIA, COMERCIO..."), e um split simples quebraria a linha.
export function separarLinha(linha) {
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

export const escapar = (valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`;

// BOM no início: sem ele o Excel em português abre os acentos errados.
export function montarCsv(colunas, registros) {
  return (
    "﻿" +
    [
      colunas.map(escapar).join(","),
      ...registros.map((r) => colunas.map((c) => escapar(r[c])).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}

// Lê um CSV já existente como objetos indexados por CNPJ.
//
// É o que permite rodar o coletor de novo sem apagar telefone, anotação de
// ligação e tudo mais que foi preenchido à mão depois.
export function lerCsv(bruto) {
  const linhas = bruto
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/);
  if (linhas.length < 2) return { cabecalho: [], registros: new Map() };
  const cabecalho = separarLinha(linhas[0]);
  const registros = new Map();
  for (const linha of linhas.slice(1)) {
    const campos = separarLinha(linha);
    const registro = {};
    cabecalho.forEach((coluna, i) => {
      registro[coluna] = campos[i] ?? "";
    });
    const chave = String(registro["CNPJ"] ?? "").replace(/\D/g, "");
    if (chave.length === 14) registros.set(chave, registro);
  }
  return { cabecalho, registros };
}

// Empresas cujo nome sugere pet.
//
// O filtro erra para os dois lados e não tem como não errar: deixa passar
// "FS CASA COMERCIO DE ARTIGOS DE DECORACAO" (o "casa" bate) e perde quem
// trabalha com pet sob um nome de sobrenome de família. Por isso ele nunca
// descarta sozinho numa lista que importa — serve para ORDENAR o trabalho
// caro, que é a consulta de telefone, um CNPJ por vez.
export const NOME_PET =
  /\bPET\b|PETS|ANIMAL|ANIMAIS|VETERIN|RACAO|RAÇÃO|AGROPEC|ZOO|\bCAO\b|CAES|CACHORR|GATO|BICHO|FOCINHO|AUAU|MIAU|CANIL|\bVET\b|AQUAR|PASSARO|AVIARIO/i;

export const barrinha = (texto) => process.stdout.write(`\r${texto}   `);
