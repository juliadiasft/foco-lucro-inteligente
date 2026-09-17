// A leitura de tabela de preço em .xlsx.
//
//   node scripts/planilha-xlsx.test.mjs
//
// O leitor foi escrito sem biblioteca (ver src/lib/planilha-xlsx.ts), então este
// teste monta arquivos .xlsx byte a byte com os casos que uma tabela de
// distribuidor traz de verdade. Antes de existir, o leitor também foi conferido
// contra quatro planilhas reais salvas pelo Excel e pelo Google Planilhas.
import { deflateRawSync } from "node:zlib";
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { lerXlsx } = await import("../src/lib/planilha-xlsx.ts");
const { parseBrazilianNumber } = await import("../src/lib/spreadsheet.ts");

// --- um ZIP mínimo, do jeito que o Excel grava ---
const tabelaCrc = Array.from({ length: 256 }, (_v, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = tabelaCrc[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(arquivos, { comprimir = true } = {}) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const nomeBytes = Buffer.from(nome);
    const cru = Buffer.from(texto);
    const dados = comprimir ? deflateRawSync(cru) : cru;
    const metodo = comprimir ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc32(cru), 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(cru.length, 22);
    local.writeUInt16LE(nomeBytes.length, 26);
    locais.push(local, nomeBytes, dados);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc32(cru), 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(cru.length, 24);
    central.writeUInt16LE(nomeBytes.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nomeBytes);
    deslocamento += 30 + nomeBytes.length + dados.length;
  }
  const indice = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(indice.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, indice, fim]);
}

const livro = (abas) =>
  `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas
    .map((a, i) => `<sheet name="${a.nome}" sheetId="${i + 1}" r:id="${a.rid}"/>`)
    .join("")}</sheets></workbook>`;
const relacoes = (abas) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships>${abas
    .map((a) => `<Relationship Id="${a.rid}" Type="worksheet" Target="${a.alvo}"/>`)
    .join("")}</Relationships>`;

// A tabela de um distribuidor, com o que costuma vir junto.
const compartilhados = `<?xml version="1.0" encoding="UTF-8"?><sst>
  <si><t>TABELA DE PREÇOS — SETEMBRO</t></si>
  <si><t>Produto</t></si>
  <si><t>Marca</t></si>
  <si><t>Unidade</t></si>
  <si><t>Embalagem</t></si>
  <si><t>Preço</t></si>
  <si><r><rPr><b/></rPr><t>Ração Golden </t></r><r><t xml:space="preserve">Adulto &amp; Castrado</t></r></si>
  <si><t>kg</t></si>
  <si><t>Areia Pipicat &lt;4kg&gt;</t></si>
  <si><t>un</t></si>
  <si><t>小</t><rPh><t>ショウ</t></rPh></si>
</sst>`;
const abaDeDados = `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c></row>
  <row r="2"/>
  <row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c><c r="D3" t="s"><v>4</v></c><c r="E3" t="s"><v>5</v></c></row>
  <row r="4"><c r="A4" t="s"><v>6</v></c><c r="B4" t="inlineStr"><is><t>Golden</t></is></c><c r="C4" t="s"><v>7</v></c><c r="D4"><v>15</v></c><c r="E4"><v>139.90000000000001</v></c></row>
  <row r="5"><c r="A5" t="s"><v>8</v></c><c r="C5" t="s"><v>9</v></c><c r="D5"><v>1</v></c><c r="E5" s="3"><v>19.9</v></c></row>
  <row r="6"><c r="A6" t="s"><v>10</v></c><c r="E6" t="str"><v>sob consulta</v></c></row>
</sheetData></worksheet>`;

console.log("--- tabela de distribuidor comprimida, como o Excel grava ---");
{
  // A primeira aba visível é "Preços", guardada como sheet2.xml: o Excel faz
  // isso quando a pessoa arrasta a aba para o começo.
  const abas = [
    { nome: "Preços", rid: "rId2", alvo: "worksheets/sheet2.xml" },
    { nome: "Rascunho", rid: "rId1", alvo: "worksheets/sheet1.xml" },
  ];
  const arquivo = zip({
    "xl/workbook.xml": livro(abas),
    "xl/_rels/workbook.xml.rels": relacoes(abas),
    "xl/sharedStrings.xml": compartilhados,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>NAO E ESTA</t></is></c><c r="B1" t="inlineStr"><is><t>ABA</t></is></c></row></sheetData></worksheet>`,
    "xl/worksheets/sheet2.xml": abaDeDados,
  });
  const s = await lerXlsx(new Uint8Array(arquivo));

  ok(
    s.headers.join("|") === "Produto|Marca|Unidade|Embalagem|Preço",
    `pula o título e acha o cabeçalho (${s.headers.join("|")})`,
  );
  ok(s.rows.length === 3, `três produtos (${s.rows.length})`);
  ok(
    s.rows[0][0] === "Ração Golden Adulto & Castrado",
    `texto em pedaços formatados vira um só (${s.rows[0][0]})`,
  );
  ok(s.rows[0][1] === "Golden", "texto guardado dentro da própria célula");
  ok(s.rows[0][4] === "139.9", `ruído de ponto flutuante sai (${s.rows[0][4]})`);
  ok(
    parseBrazilianNumber(s.rows[0][4]) === 139.9,
    "e o preço chega à importação como R$ 139,90, não R$ 13.990",
  );
  ok(s.rows[1][0] === "Areia Pipicat <4kg>", `entidades do XML desfeitas (${s.rows[1][0]})`);
  ok(
    s.rows[1][1] === "" && s.rows[1][2] === "un",
    "célula vazia no meio não escorrega as colunas seguintes",
  );
  ok(parseBrazilianNumber(s.rows[1][4]) === 19.9, "preço com formatação de moeda lido como número");
  ok(s.rows[2][0] === "小", "leitura fonética (rPh) não entra no texto");
  ok(s.rows[2][4] === "sob consulta", "texto de fórmula lido");
  ok(
    s.rows.every((linha) => linha.length === 5),
    "toda linha com a largura do cabeçalho",
  );
}

console.log("\n--- arquivo sem compressão, e sem o índice de abas ---");
{
  const s = await lerXlsx(
    new Uint8Array(
      zip(
        { "xl/sharedStrings.xml": compartilhados, "xl/worksheets/sheet1.xml": abaDeDados },
        { comprimir: false },
      ),
    ),
  );
  ok(s.rows.length === 3 && s.headers[0] === "Produto", "lê do mesmo jeito");
}

console.log("\n--- o que não é .xlsx ---");
{
  const xlsAntigo = new Uint8Array([
    0xd0,
    0xcf,
    0x11,
    0xe0,
    0xa1,
    0xb1,
    0x1a,
    0xe1,
    ...Array(600).fill(0),
  ]);
  let mensagem = "";
  try {
    await lerXlsx(xlsAntigo);
  } catch (erro) {
    mensagem = erro.message;
  }
  ok(/\.xls antigo/.test(mensagem), `.xls antigo explica o que fazer ("${mensagem}")`);

  mensagem = "";
  try {
    await lerXlsx(new Uint8Array(Buffer.from("Produto;Preço\nRação;10")));
  } catch (erro) {
    mensagem = erro.message;
  }
  ok(
    /não é uma planilha \.xlsx/.test(mensagem),
    "CSV renomeado para .xlsx dá erro claro, e não trava",
  );
}

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
