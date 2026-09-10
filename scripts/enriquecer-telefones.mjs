// Busca telefone, e-mail e situação cadastral de cada empresa da planilha.
//
//   node scripts/enriquecer-telefones.mjs [quantas]
//
// Exemplo: node scripts/enriquecer-telefones.mjs 100
//
// A listagem por CNAE traz razão social, CNPJ e cidade — telefone não. Ele vem
// da consulta individual na Receita, um CNPJ por vez.
//
// Por isso o script é incremental: ele lê a planilha, preenche só as linhas
// que ainda estão sem telefone, e grava por cima. Rodar de novo continua de
// onde parou. Assim dá para enriquecer cem hoje, mais cem amanhã, sem repetir
// consulta e sem esperar horas por 5.500 de uma vez.
//
// Uma pausa de 1,2s entre consultas: a BrasilAPI é gratuita e mantida por
// terceiros. Puxar milhares o mais rápido possível seria abusar de quem está
// servindo de graça — e a primeira coisa que acontece é o IP ser bloqueado,
// o que atrapalha a própria Central, que usa a mesma API no cadastro.
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

// Duas listas, o mesmo trabalho: buscar telefone um CNPJ por vez.
//
//   node scripts/enriquecer-telefones.mjs 500            -> fornecedores
//   node scripts/enriquecer-telefones.mjs 500 petshops   -> pet shops
//
// O terceiro argumento aceita também uma UF, para gastar a rodada onde ela vai
// ligar de fato:
//
//   node scripts/enriquecer-telefones.mjs 300 petshops SP
//
// Sem isso, buscar telefone dos 113 mil pet shops levaria 38 horas — e ela só
// precisa de cinquenta.
const PLANILHAS = {
  fornecedores: "C:/Users/julia/OneDrive/Desktop/fornecedores-petshop.csv",
  petshops: "C:/Users/julia/OneDrive/Desktop/comerciantes-petshop.csv",
};
const QUAL = (process.argv[3] || "fornecedores").toLowerCase();
const PLANILHA = PLANILHAS[QUAL];
if (!PLANILHA) {
  console.error(`Nao conheco a lista "${QUAL}". Use: ${Object.keys(PLANILHAS).join(" ou ")}.`);
  process.exit(1);
}
const SO_ESTA_UF = (process.argv[4] || "").trim().toUpperCase();
const PAUSA_MS = 1200;
const LIMITE = Number(process.argv[2]) || 100;

const USER_AGENT =
  "CentralDoComerciante/1.0 (prospeccao propria; +https://central-do-comerciante.onrender.com)";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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

// A Receita não guarda telefone num formato só, e a primeira versão disto
// perdia contato por causa disso. Dois defeitos reais, achados conferindo na
// fonte o que tinha ficado em branco na planilha:
//
//   "01158515047"  — o 0 de discagem colado na frente. Tirando o zero vira
//                    (11) 5851-5047, um número perfeito que estava saindo como
//                    "(01) 15851-5047" e ninguém conseguiria discar.
//   "442541167"    — nove dígitos: DDD 44 mais um fixo antigo de sete. A
//                    versão antiga devolvia vazio, e como a linha já contava
//                    como consultada ela nunca mais seria olhada. O contato
//                    sumia em silêncio. Numa amostra de oito sem telefone, um
//                    era deste tipo.
//
// Não dá para completar o número antigo: a maioria das cidades ganhou um "3"
// na frente, mas não todas, e inventar dígito é pior que entregar incompleto.
// Então ele vai como veio, marcado — dá para achar no Google pelo nome da
// empresa. Regra geral: se a Receita mandou alguma coisa, ela é gravada.
// Campo em branco passa a significar só uma coisa — não havia telefone.
// O nono dígito. A Receita guarda telefone no formato de antes de 2016 — a
// planilha inteira veio com dez dígitos, sem exceção. Nos fixos tudo bem, mas
// celular de dez dígitos não disca mais em lugar nenhum do Brasil, e 28% dos
// números da lista são celular. Sem isto, quase um terço dos contatos seria
// entregue quebrado.
//
// A regra da Anatel é fechada e vale para o país todo: todo celular ganhou um
// "9" na frente do número, e celular é o que começa com 6, 7, 8 ou 9 depois do
// DDD. Fixo começa com 2, 3, 4 ou 5 e fica como está. Não é chute — é uma
// conversão exata, diferente do caso do fixo de sete dígitos logo abaixo, onde
// o dígito que falta muda de cidade para cidade e por isso não é inventado.
const ehCelular = (d) => d.length === 10 && "6789".includes(d[2]);

const formatarTelefone = (bruto) => {
  let d = (bruto || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  if (ehCelular(d)) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9 || d.length === 8)
    return `(${d.slice(0, 2)}) ${d.slice(2)} (cadastro antigo)`;
  return `${d} (conferir)`;
};

const bruto = await readFile(PLANILHA, "utf8");
const linhas = bruto
  .replace(/^\ufeff/, "")
  .trim()
  .split(/\r?\n/);
const cabecalho = separarLinha(linhas[0]);
const iCnpj = cabecalho.indexOf("CNPJ");
const iTelefone = cabecalho.indexOf("Telefone");
const iEmail = cabecalho.indexOf("Email");
const iSituacao = cabecalho.indexOf("Situacao na Receita");
const iRamo = cabecalho.indexOf("Ramo principal");
// A coluna já se chamou "Atacado de racao", quando a lista era só de ração.
// Aceita os dois nomes para não quebrar numa planilha que ficou parada.
const iConfere =
  cabecalho.indexOf("Confere na Receita") >= 0
    ? cabecalho.indexOf("Confere na Receita")
    : cabecalho.indexOf("Atacado de racao");

if (iCnpj < 0 || iTelefone < 0) {
  console.error("A planilha nao tem as colunas esperadas. Rode o coletar primeiro.");
  process.exit(1);
}

// Abastecer pet shop e a atividade PRINCIPAL da empresa, ou so um CNAE
// secundario pendurado no cadastro?
//
// A listagem por CNAE mistura os dois. Numa amostra de seis, tres eram
// principal e tres eram fabrica de produto quimico, fabrica de medicamento
// veterinario e atacado de maquinas agricolas — que tem o CNAE de racao
// pendurado como atividade secundaria.
//
// Nao da para simplesmente descartar os secundarios: uma fabrica de
// medicamento veterinario pode ser fornecedor legitimo de pet shop. Mas ligar
// para uma revenda de trator achando que e distribuidora de racao desperdicaria
// a ligacao. Por isso a planilha marca em vez de excluir — quem decide e a
// Julia, ordenando a coluna.
//
// Sao os mesmos CNAEs que o coletar-fornecedores-pet.mjs usa como fonte. O
// 4789004 (varejo de artigos e alimentos para animais) entra so aqui, nao la:
// e o proprio pet shop, e nao vale a pena coletar as 113 mil lojas do pais —
// mas quando uma delas aparece na lista de atacado, e porque tambem revende, e
// isso a Julia precisa ver antes de ligar.
const CNAES_PET = new Set([
  "4623109", // atacado de alimentos para animais
  "4644302", // atacado de medicamentos de uso veterinario
  "1066000", // fabricacao de alimentos para animais
  "2122000", // fabricacao de medicamentos de uso veterinario
  "4623101", // atacado de animais vivos
  "4649499", // atacado de outros artigos de uso pessoal e domestico
  "4692300", // atacado com predominancia de insumos agropecuarios
  "4789004", // varejo de animais vivos e de artigos para animais de estimacao
]);
function classificar(dados) {
  const principal = String(dados.cnae_fiscal ?? "").padStart(7, "0");
  if (CNAES_PET.has(principal)) return "principal";
  const secundarios = (dados.cnaes_secundarios || []).map((c) =>
    String(c?.codigo ?? "").padStart(7, "0"),
  );
  return secundarios.some((c) => CNAES_PET.has(c)) ? "secundario" : "nao tem";
}

const dados = linhas.slice(1).map(separarLinha);
const iUf = cabecalho.indexOf("UF");

// Ordem das consultas: um estado de cada vez, em rodizio.
//
// A primeira versao comecava por Sao Paulo. A Julia corrigiu: o foco e o
// Brasil inteiro. E o arquivo esta em ordem alfabetica, entao ir na ordem
// natural faria a primeira rodada ser Acre e Alagoas inteiros e mais nada.
//
// O rodizio resolve os dois: pega um de SP, um de MG, um do AC, e recomeca.
// Como a rodada quase sempre para no meio (sao horas de consulta), o que ja
// esta pronto a qualquer momento e uma amostra do pais todo, e nao um canto
// dele. Parar na metade deixa de ser prejuizo.
function emRodizio(linhas) {
  const porUf = new Map();
  for (const linha of linhas) {
    const uf = (linha[iUf] || "??").trim().toUpperCase();
    if (!porUf.has(uf)) porUf.set(uf, []);
    porUf.get(uf).push(linha);
  }
  // Dentro de cada estado, quem tem nome de pet primeiro.
  //
  // A listagem por CNAE traz junto quem só tem o código pendurado como
  // atividade secundária — "CABANAS RESTAURANTE", "MINAS AUTO PECAS". Não dá
  // para saber quem é quem sem consultar, e consultar é o que custa caro: são
  // 1,2 segundo por empresa, horas de rodada.
  //
  // O nome é o único sinal de graça. Ele erra dos dois lados, então não serve
  // para descartar ninguém — mas serve para escolher a ordem. Assim a primeira
  // hora de consulta entrega distribuidora de ração em vez de restaurante, e
  // parar no meio continua sendo um resultado bom.
  const iSugere = cabecalho.indexOf("Nome sugere pet");
  const peso = (linha) => (iSugere >= 0 && linha[iSugere] === "sim" ? 0 : 1);
  for (const fila of porUf.values()) fila.sort((a, b) => peso(a) - peso(b));

  // Estados maiores primeiro dentro de cada volta: se a rodada for curta, a
  // amostra fica proporcional ao tamanho real de cada estado.
  const filas = [...porUf.values()].sort((a, b) => b.length - a.length);
  const ordenadas = [];
  for (let i = 0; ordenadas.length < linhas.length; i += 1) {
    for (const fila of filas) if (i < fila.length) ordenadas.push(fila[i]);
  }
  return ordenadas;
}

const semTelefone = dados.filter((linha) => !linha[iTelefone]?.trim());
const noRecorte = SO_ESTA_UF
  ? semTelefone.filter((linha) => (linha[iUf] || "").trim().toUpperCase() === SO_ESTA_UF)
  : semTelefone;
const pendentes = emRodizio(noRecorte);

if (SO_ESTA_UF && !noRecorte.length) {
  console.error(`Nenhuma empresa de ${SO_ESTA_UF} sem telefone nesta lista.`);
  process.exit(1);
}

console.log(`Lista: ${QUAL}${SO_ESTA_UF ? ` (so ${SO_ESTA_UF})` : ""}`);
console.log(`${dados.length} empresas na planilha, ${pendentes.length} ainda sem telefone.`);
console.log(`Consultando ate ${LIMITE} nesta rodada.\n`);

let consultadas = 0;
let comTelefone = 0;
let falhas = 0;
const contagemClasse = {};

async function gravar() {
  const saida = [
    cabecalho.map(escapar).join(","),
    ...dados.map((linha) => linha.map(escapar).join(",")),
  ];
  await writeFile(PLANILHA, "﻿" + saida.join("\r\n") + "\r\n", "utf8");
}

for (const linha of pendentes) {
  if (consultadas >= LIMITE) break;
  const cnpj = (linha[iCnpj] || "").replace(/\D/g, "");
  if (cnpj.length !== 14) continue;

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (resposta.ok) {
      const d = await resposta.json();
      const telefone = formatarTelefone(d.ddd_telefone_1);
      linha[iTelefone] = telefone;
      if (iEmail >= 0) linha[iEmail] = (d.email || "").trim();
      if (iSituacao >= 0) linha[iSituacao] = (d.descricao_situacao_cadastral || "").trim();
      if (iRamo >= 0) linha[iRamo] = (d.cnae_fiscal_descricao || "").trim();
      if (iConfere >= 0) {
        const classe = classificar(d);
        linha[iConfere] = classe;
        contagemClasse[classe] = (contagemClasse[classe] || 0) + 1;
      }
      if (telefone) comTelefone += 1;
    } else {
      falhas += 1;
      // Marca para nao tentar de novo em toda rodada.
      if (iSituacao >= 0) linha[iSituacao] = `nao consultado (${resposta.status})`;
    }
  } catch {
    falhas += 1;
  }

  consultadas += 1;
  process.stdout.write(`\r${consultadas}/${LIMITE} consultadas · ${comTelefone} com telefone   `);

  // Grava a cada 50. Uma rodada de 5.200 leva quase duas horas; guardar tudo
  // para o fim significaria perder o trabalho inteiro se a maquina dormir, a
  // internet cair ou alguem fechar o terminal. E como o script pula quem ja
  // tem telefone, um arquivo salvo no meio do caminho e um ponto de retomada.
  if (consultadas % 50 === 0) await gravar();

  await dormir(PAUSA_MS);
}

await gravar();

const totalComTelefone = dados.filter((l) => l[iTelefone]?.trim()).length;
console.log(`\n\n${consultadas} consultadas nesta rodada, ${comTelefone} com telefone.`);
if (falhas) console.log(`${falhas} nao responderam — ficam para a proxima rodada.`);
const rotulos = {
  principal: "abastecem pet shop como atividade principal",
  secundario: "abastecem pet shop como atividade secundaria",
  "nao tem": "nenhum CNAE de pet — vieram da listagem por engano",
};
for (const [classe, total] of Object.entries(contagemClasse))
  console.log(`  ${String(total).padStart(4)} ${rotulos[classe] || classe}`);
console.log(`\nA planilha agora tem ${totalComTelefone} de ${dados.length} com telefone.`);
console.log(`Para continuar: node scripts/enriquecer-telefones.mjs 200`);
