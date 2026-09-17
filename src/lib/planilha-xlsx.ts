// Lê um arquivo do Excel (.xlsx) no próprio navegador, sem biblioteca.
//
// Por que existe: a tabela de preço de distribuidor chega em .xlsx, e a tela de
// importação só aceitava CSV ou colar. No cadastro assistido do fornecedor isso
// virava uma etapa manual de "abrir no Excel, salvar como CSV" para cada
// tabela recebida.
//
// Por que sem biblioteca: o pacote "xlsx" do npm parou numa versão com falha
// de segurança conhecida, e as alternativas trazem centenas de KB para a tela.
// Um .xlsx é um ZIP com alguns XML dentro; o navegador já sabe descompactar
// (DecompressionStream) e o formato das células é regular. Lemos só o que a
// importação usa: a primeira aba, como texto.
//
// O arquivo continua sem sair do computador: a leitura é toda aqui.

import type { Sheet } from "./spreadsheet";

type EntradaZip = { nome: string; metodo: number; tamanho: number; deslocamento: number };

function lerZip(bytes: Uint8Array): Map<string, EntradaZip> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // O índice do ZIP fica no fim do arquivo, depois de um comentário opcional
  // de até 65 KB: procura a assinatura de trás para frente.
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("Este arquivo não é uma planilha .xlsx válida.");

  const quantas = dv.getUint16(fim + 10, true);
  let posicao = dv.getUint32(fim + 16, true);
  const entradas = new Map<string, EntradaZip>();
  const decodificar = new TextDecoder();

  for (let n = 0; n < quantas; n += 1) {
    if (dv.getUint32(posicao, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(posicao + 10, true);
    const tamanho = dv.getUint32(posicao + 20, true);
    const tamNome = dv.getUint16(posicao + 28, true);
    const tamExtra = dv.getUint16(posicao + 30, true);
    const tamComentario = dv.getUint16(posicao + 32, true);
    const deslocamento = dv.getUint32(posicao + 42, true);
    const nome = decodificar.decode(bytes.subarray(posicao + 46, posicao + 46 + tamNome));
    entradas.set(nome, { nome, metodo, tamanho, deslocamento });
    posicao += 46 + tamNome + tamExtra + tamComentario;
  }
  return entradas;
}

async function extrair(bytes: Uint8Array, entrada: EntradaZip): Promise<string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // O cabeçalho local repete nome e extra com tamanhos próprios, que podem
  // diferir dos do índice: o começo dos dados sai daqui, não de lá.
  const tamNome = dv.getUint16(entrada.deslocamento + 26, true);
  const tamExtra = dv.getUint16(entrada.deslocamento + 28, true);
  const inicio = entrada.deslocamento + 30 + tamNome + tamExtra;
  const dados = bytes.slice(inicio, inicio + entrada.tamanho);

  if (entrada.metodo === 0) return new TextDecoder().decode(dados);
  if (entrada.metodo !== 8)
    throw new Error("Esta planilha usa uma compressão que não conseguimos ler. Salve como .xlsx.");
  const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(fluxo).text();
}

function desfazerEntidades(texto: string) {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Todo o texto de um <si> ou <is>, inclusive quando vem em pedaços formatados. */
function textoDasPartes(xml: string) {
  // <rPh> é a leitura fonética do japonês: tem <t> dentro e não faz parte do valor.
  const semFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let texto = "";
  for (const m of semFonetica.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) texto += m[1];
  return desfazerEntidades(texto);
}

function indiceDaColuna(referencia: string) {
  let indice = 0;
  for (const letra of referencia.replace(/\d+$/, ""))
    indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return indice - 1;
}

function atributo(atributos: string, nome: string) {
  return new RegExp(`\\b${nome}="([^"]*)"`).exec(atributos)?.[1];
}

/**
 * O número como texto que a importação já sabe ler.
 *
 * O Excel guarda 12,9 como "12.9" — às vezes "12.900000000000001". Os 12
 * dígitos significativos tiram esse ruído de ponto flutuante sem arredondar
 * preço nenhum de verdade.
 */
function numeroLimpo(valor: string) {
  const n = Number(valor);
  return Number.isFinite(n) ? String(Number(n.toPrecision(12))) : valor;
}

export async function lerXlsx(arquivo: ArrayBuffer | Uint8Array): Promise<Sheet> {
  const bytes = arquivo instanceof Uint8Array ? arquivo : new Uint8Array(arquivo);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf)
    throw new Error("Este é um arquivo .xls antigo. No Excel, use Salvar como → .xlsx ou CSV.");

  const zip = lerZip(bytes);
  const ler = async (nome: string) => {
    const entrada = zip.get(nome);
    return entrada ? await extrair(bytes, entrada) : null;
  };

  // A primeira aba na ordem das abas, e não "sheet1.xml": quem reordenou as
  // abas no Excel tem a primeira visível guardada com outro nome.
  let caminhoDaAba = "xl/worksheets/sheet1.xml";
  const livro = await ler("xl/workbook.xml");
  const relacoes = await ler("xl/_rels/workbook.xml.rels");
  const primeira = livro && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(livro)?.[1];
  if (primeira && relacoes) {
    const alvo =
      new RegExp(`<Relationship\\b[^>]*\\bId="${primeira}"[^>]*\\bTarget="([^"]+)"`).exec(
        relacoes,
      )?.[1] ??
      new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${primeira}"`).exec(
        relacoes,
      )?.[1];
    if (alvo) caminhoDaAba = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo}`;
  }

  const aba = await ler(caminhoDaAba);
  if (!aba) throw new Error("Não encontrei nenhuma aba com dados nesta planilha.");

  const compartilhados: string[] = [];
  const textos = await ler("xl/sharedStrings.xml");
  if (textos)
    for (const m of textos.matchAll(/<si>([\s\S]*?)<\/si>/g))
      compartilhados.push(textoDasPartes(m[1]));

  const linhas: string[][] = [];
  for (const linha of aba.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const celulas: string[] = [];
    let proxima = 0;
    for (const c of (linha[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = c[1];
      const conteudo = c[2] ?? "";
      const referencia = atributo(atributos, "r");
      // Célula vazia não é gravada: a coluna vem da referência ("D7"), senão
      // tudo depois de um buraco escorrega uma coluna para a esquerda.
      const coluna = referencia ? indiceDaColuna(referencia) : proxima;
      const tipo = atributo(atributos, "t");
      const bruto = /<v>([\s\S]*?)<\/v>/.exec(conteudo)?.[1];

      let valor = "";
      if (tipo === "s") valor = compartilhados[Number(bruto)] ?? "";
      else if (tipo === "inlineStr")
        valor = textoDasPartes(/<is>([\s\S]*?)<\/is>/.exec(conteudo)?.[1] ?? "");
      else if (tipo === "str" || tipo === "e") valor = desfazerEntidades(bruto ?? "");
      else if (tipo === "b") valor = bruto === "1" ? "VERDADEIRO" : "FALSO";
      else if (bruto !== undefined) valor = numeroLimpo(bruto);

      celulas[coluna] = valor.trim();
      proxima = coluna + 1;
    }
    const completa = Array.from(celulas, (valor) => valor ?? "");
    if (completa.some((valor) => valor !== "")) linhas.push(completa);
  }

  // Tabela de distribuidor costuma ter título em cima ("TABELA DE PREÇOS —
  // SETEMBRO") antes do cabeçalho de verdade. O cabeçalho é a primeira linha
  // com pelo menos duas colunas preenchidas; o que vem antes é descartado.
  const inicio = linhas.findIndex((linha) => linha.filter((valor) => valor !== "").length >= 2);
  if (inicio < 0) return { headers: [], rows: [] };

  const largura = Math.max(...linhas.slice(inicio).map((linha) => linha.length));
  const alinhar = (linha: string[]) => [...linha, ...Array(largura - linha.length).fill("")];
  return { headers: alinhar(linhas[inicio]), rows: linhas.slice(inicio + 1).map(alinhar) };
}
