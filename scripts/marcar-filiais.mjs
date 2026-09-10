// Marca quem é matriz e quem é filial nas duas planilhas.
//
//   node scripts/marcar-filiais.mjs
//
// Roda quantas vezes quiser: só preenche colunas, nunca apaga nada.
//
// POR QUE. A Receita cadastra cada endereço como um CNPJ diferente, mas os
// oito primeiros dígitos são iguais quando é a mesma empresa. "A M F DOS
// SANTOS PRODUTOS VETERINARIOS" aparece duas vezes na lista de fornecedores,
// 33.250.974/0001-82 em Rio Bonito do Iguaçu e 33.250.974/0002-63 em
// Laranjeiras do Sul — a mesma empresa, o mesmo dono, o mesmo catálogo.
//
// Sem esta marca a Julia liga duas vezes para a mesma pessoa. Nos pet shops
// isso vale 4% das linhas; nos fornecedores, 24% — a COCAMAR sozinha tem 112
// unidades, e a PET CENTER, 286 lojas.
//
// O /0001 é sempre a matriz. É para ela que se liga: é onde ficam a decisão de
// compra, o financeiro e quem assina contrato.
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const PLANILHAS = [
  "C:/Users/julia/OneDrive/Desktop/comerciantes-petshop.csv",
  "C:/Users/julia/OneDrive/Desktop/fornecedores-petshop.csv",
];

// As duas colunas novas, e o que cada uma responde:
//
//   "Matriz ou filial"      -> ligo para esta, ou para outra?
//   "Enderecos da empresa"  -> é uma loja de bairro ou uma rede de 286?
//
// A segunda muda a conversa inteira. Ligar para a PET CENTER achando que é
// pet shop de esquina é perder a ligação.
const COL_TIPO = "Matriz ou filial";
const COL_QUANTOS = "Enderecos da empresa";

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

const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

for (const caminho of PLANILHAS) {
  let bruto;
  try {
    bruto = await readFile(caminho, "utf8");
  } catch {
    console.log(`${caminho.split("/").pop()}: nao encontrada, pulando.`);
    continue;
  }

  const linhas = bruto
    .replace(/^\ufeff/, "")
    .trim()
    .split(/\r?\n/);
  const cabecalho = separarLinha(linhas[0]);
  const iCnpj = cabecalho.indexOf("CNPJ");
  if (iCnpj < 0) {
    console.log(`${caminho.split("/").pop()}: sem coluna CNPJ, pulando.`);
    continue;
  }

  // As colunas novas entram logo depois do CNPJ, para ficarem à vista de quem
  // abre a planilha — e não na décima quinta posição, onde ninguém rola.
  const dados = linhas.slice(1).map(separarLinha);
  let iTipo = cabecalho.indexOf(COL_TIPO);
  let iQuantos = cabecalho.indexOf(COL_QUANTOS);
  if (iTipo < 0) {
    cabecalho.splice(iCnpj + 1, 0, COL_TIPO, COL_QUANTOS);
    for (const linha of dados) linha.splice(iCnpj + 1, 0, "", "");
    iTipo = iCnpj + 1;
    iQuantos = iCnpj + 2;
  }

  // Agrupa pelos oito primeiros dígitos: essa é a empresa.
  const porRaiz = new Map();
  for (const linha of dados) {
    const digitos = (linha[iCnpj] || "").replace(/\D/g, "");
    if (digitos.length !== 14) continue;
    const raiz = digitos.slice(0, 8);
    if (!porRaiz.has(raiz)) porRaiz.set(raiz, []);
    porRaiz.get(raiz).push({ linha, ordem: digitos.slice(8, 12) });
  }

  let matrizes = 0;
  let filiais = 0;
  let unicas = 0;
  for (const grupo of porRaiz.values()) {
    for (const { linha, ordem } of grupo) {
      if (grupo.length === 1) {
        // Endereço único. Mesmo que o número não seja 0001 — acontece quando a
        // matriz fechou e a filial continuou —, para quem vai ligar é uma
        // empresa de um endereço só, e é isso que interessa.
        linha[iTipo] = "unica";
        unicas += 1;
      } else if (ordem === "0001") {
        linha[iTipo] = "matriz";
        matrizes += 1;
      } else {
        linha[iTipo] = "filial";
        filiais += 1;
      }
      linha[iQuantos] = String(grupo.length);
    }
  }

  // Terceira coluna: quantas empresas dividem este mesmo telefone.
  //
  // É o que separa a rede grande do resto sem precisar reconhecer a marca. A
  // PET CENTER tem 365 unidades e o telefone (11) 3434-6800 em TODAS, com o
  // e-mail postofiscal@petz.com.br — é o call center corporativo, e ligar nas
  // 365 é ligar 365 vezes no mesmo lugar. O franqueado é o oposto: CNPJ
  // próprio, telefone próprio, dono próprio, e aparece aqui com "1".
  //
  // Vale mais que a coluna de matriz/filial, porque pega também o que o CNPJ
  // não mostra: empresas de CNPJ diferente que compartilham a mesma central de
  // atendimento — e que portanto são a mesma conversa.
  const COL_TELS = "Contatos iguais a este";
  let iTels = cabecalho.indexOf(COL_TELS);
  if (iTels < 0) {
    cabecalho.splice(iQuantos + 1, 0, COL_TELS);
    for (const linha of dados) linha.splice(iQuantos + 1, 0, "");
    iTels = iQuantos + 1;
  }
  const iTel = cabecalho.indexOf("Telefone");
  const quantosNoTelefone = new Map();
  if (iTel >= 0) {
    for (const linha of dados) {
      const tel = (linha[iTel] || "").replace(/\D/g, "");
      if (tel.length >= 10) quantosNoTelefone.set(tel, (quantosNoTelefone.get(tel) || 0) + 1);
    }
    for (const linha of dados) {
      const tel = (linha[iTel] || "").replace(/\D/g, "");
      linha[iTels] = tel.length >= 10 ? String(quantosNoTelefone.get(tel)) : "";
    }
  }
  const centrais = [...quantosNoTelefone.values()].filter((q) => q >= 10).length;
  const emCentral = dados.filter((l) => Number(l[iTels]) >= 10).length;

  const csv = [
    cabecalho.map(escapar).join(","),
    ...dados.map((linha) => linha.map(escapar).join(",")),
  ];
  await writeFile(caminho, "\ufeff" + csv.join("\r\n") + "\r\n", "utf8");

  const nome = caminho.split("/").pop();
  const redes = [...porRaiz.values()].filter((g) => g.length > 1).length;
  console.log(`${nome}:`);
  console.log(`  ${porRaiz.size.toLocaleString("pt-BR")} empresas em ${dados.length.toLocaleString("pt-BR")} enderecos`);
  console.log(`  ${unicas.toLocaleString("pt-BR")} de endereco unico`);
  console.log(`  ${matrizes.toLocaleString("pt-BR")} matrizes e ${filiais.toLocaleString("pt-BR")} filiais, de ${redes.toLocaleString("pt-BR")} empresas com mais de um endereco`);
  console.log(`  -> ligar para as ${(unicas + matrizes).toLocaleString("pt-BR")} 'unica' e 'matriz'; as ${filiais.toLocaleString("pt-BR")} filiais sao a mesma conversa`);
  console.log(
    `  ${centrais.toLocaleString("pt-BR")} telefones atendem 10 ou mais empresas (central corporativa),` +
      ` cobrindo ${emCentral.toLocaleString("pt-BR")} linhas\n`,
  );
}

console.log("Agora regenere os paineis:");
console.log("  node scripts/painel-fornecedores.mjs");
console.log("  node scripts/painel-fornecedores.mjs petshops");
process.exit(0);
