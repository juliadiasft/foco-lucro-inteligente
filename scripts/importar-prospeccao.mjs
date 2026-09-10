// Leva as planilhas de prospecção para dentro do sistema.
//
//   node scripts/importar-prospeccao.mjs
//
// Roda quantas vezes quiser: reconhece pelo CNPJ quem já está lá e atualiza
// só o que veio da Receita. O trabalho de prospecção — status, quem falou,
// de quem o pet shop compra, observações — nunca é sobrescrito.
//
// Essa distinção é o coração do script. Os dados da Receita mudam quando a
// lista é refeita; o que a Julia anotou depois de uma ligação não pode ser
// perdido porque alguém rodou a importação de novo.
//
// Precisa de DATABASE_URL. Em produção, o do Render.
import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

import { lerEnv } from "./ler-env.mjs";

const { Client } = pg;

const PLANILHAS = [
  { arquivo: "C:/Users/julia/OneDrive/Desktop/fornecedores-petshop.csv", lado: "fornecedor" },
  { arquivo: "C:/Users/julia/OneDrive/Desktop/comerciantes-petshop.csv", lado: "comerciante" },
];
const NICHO = "pet";

// Quantas linhas por vez. Uma por uma seriam 148 mil idas ao banco, e o banco
// está noutro continente: a 115ms cada, seriam quase cinco horas. Em lotes de
// quinhentos, são cerca de trezentas idas.
const LOTE = 500;

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

// Pega DATABASE_URL e DOCUMENT_HASH_SECRET de segredos.local, se estiverem la.
await lerEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL nao configurada.");
  console.error("Ponha no arquivo segredos.local, na raiz do projeto:");
  console.error("  DATABASE_URL=a URL que esta no Render");
  console.error("Esse arquivo e ignorado pelo git — nada dele vai para o repositorio.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});
await client.connect();

let totalNovos = 0;
let totalAtualizados = 0;

for (const { arquivo, lado } of PLANILHAS) {
  let bruto;
  try {
    bruto = await readFile(arquivo, "utf8");
  } catch {
    console.log(`${arquivo.split("/").pop()}: nao encontrada, pulando.\n`);
    continue;
  }

  const linhas = bruto
    .replace(/^\ufeff/, "")
    .trim()
    .split(/\r?\n/);
  const cabecalho = separarLinha(linhas[0]);
  const col = (nome) => cabecalho.indexOf(nome);
  const iCnpj = col("CNPJ");
  if (iCnpj < 0) {
    console.log(`${arquivo.split("/").pop()}: sem coluna CNPJ, pulando.\n`);
    continue;
  }

  const indices = {
    razao: col("Razao social"),
    fantasia: col("Nome fantasia"),
    cidade: col("Cidade"),
    uf: col("UF"),
    telefone: col("Telefone"),
    telefone2: col("Telefone 2"),
    email: col("Email"),
    situacao: col("Situacao na Receita"),
    ramo: col("Ramo principal"),
    fornece: col("Fornece"),
    confere: col("Confere na Receita"),
    matriz: col("Matriz ou filial"),
    enderecos: col("Enderecos da empresa"),
    iguais: col("Contatos iguais a este"),
    sugere: col("Nome sugere pet"),
  };

  const registros = [];
  for (const linha of linhas.slice(1)) {
    const c = separarLinha(linha);
    const pega = (i) => (i >= 0 ? (c[i] || "").trim() : "");
    const cnpj = (c[iCnpj] || "").replace(/\D/g, "");
    if (cnpj.length !== 14) continue;

    const telefone = pega(indices.telefone);
    const digitos = telefone.replace(/\D/g, "");
    // Celular tem onze dígitos com o nono na frente. Só ele tem WhatsApp:
    // mandar mensagem para fixo não chega em lugar nenhum.
    const whatsapp = digitos.length === 11 && digitos[2] === "9" ? digitos : "";

    registros.push([
      cnpj,
      pega(indices.razao),
      pega(indices.fantasia),
      lado,
      NICHO,
      pega(indices.cidade),
      pega(indices.uf).toUpperCase().slice(0, 2),
      telefone,
      pega(indices.telefone2),
      pega(indices.email).toLowerCase(),
      whatsapp,
      pega(indices.situacao),
      pega(indices.ramo),
      pega(indices.fornece),
      pega(indices.confere),
      pega(indices.matriz) || "unica",
      Number(pega(indices.enderecos)) || 1,
      Number(pega(indices.iguais)) || 1,
      pega(indices.sugere) === "sim",
    ]);
  }

  console.log(`${arquivo.split("/").pop()}: ${registros.length.toLocaleString("pt-BR")} linhas`);

  let novos = 0;
  let atualizados = 0;
  for (let inicio = 0; inicio < registros.length; inicio += LOTE) {
    const lote = registros.slice(inicio, inicio + LOTE);
    const valores = [];
    const marcadores = lote.map((registro, linha) => {
      const base = linha * 19;
      valores.push(...registro);
      return `(${Array.from({ length: 19 }, (_, k) => `$${base + k + 1}`).join(",")})`;
    });

    // ON CONFLICT atualiza SÓ o que vem da Receita. As colunas de trabalho
    // (status, responsavel_id, quem_falou, compra_de_quem, resposta,
    // observacoes, contatado_em) ficam de fora de propósito: são o que a
    // pessoa escreveu, e rodar a importação de novo não pode apagá-las.
    const resultado = await client.query(
      `INSERT INTO prospects
         (cnpj,razao_social,nome_fantasia,lado,nicho,cidade,uf,telefone,telefone2,email,
          whatsapp,situacao,ramo_principal,fornece,confere,matriz_ou_filial,
          enderecos_da_empresa,contatos_iguais,nome_sugere_pet)
       VALUES ${marcadores.join(",")}
       ON CONFLICT (cnpj) DO UPDATE SET
         razao_social = EXCLUDED.razao_social,
         nome_fantasia = EXCLUDED.nome_fantasia,
         cidade = EXCLUDED.cidade,
         uf = EXCLUDED.uf,
         telefone = EXCLUDED.telefone,
         telefone2 = EXCLUDED.telefone2,
         email = EXCLUDED.email,
         whatsapp = EXCLUDED.whatsapp,
         situacao = EXCLUDED.situacao,
         ramo_principal = EXCLUDED.ramo_principal,
         fornece = EXCLUDED.fornece,
         confere = EXCLUDED.confere,
         matriz_ou_filial = EXCLUDED.matriz_ou_filial,
         enderecos_da_empresa = EXCLUDED.enderecos_da_empresa,
         contatos_iguais = EXCLUDED.contatos_iguais,
         nome_sugere_pet = EXCLUDED.nome_sugere_pet,
         atualizado_em = now()
       RETURNING (xmax = 0) AS inserido`,
      valores,
    );
    for (const linha of resultado.rows) {
      if (linha.inserido) novos += 1;
      else atualizados += 1;
    }
    process.stdout.write(
      `\r  ${(novos + atualizados).toLocaleString("pt-BR")} de ${registros.length.toLocaleString("pt-BR")}   `,
    );
  }
  console.log(
    `\n  ${novos.toLocaleString("pt-BR")} novos, ${atualizados.toLocaleString("pt-BR")} atualizados\n`,
  );
  totalNovos += novos;
  totalAtualizados += atualizados;
}

// Quem da lista já virou cliente?
//
// A Central não guarda o CNPJ completo de ninguém — só um hash e os quatro
// últimos dígitos. Então a ligação é feita calculando o mesmo hash a partir
// do CNPJ da lista, o que respeita essa regra: nada de documento completo
// entra em trial_identity_claims por causa desta consulta.
//
// Depende do segredo DOCUMENT_HASH_SECRET ser o mesmo da aplicação. Sem ele,
// o hash não bate e nada é ligado — o script avisa em vez de fingir sucesso.
const segredo = process.env.DOCUMENT_HASH_SECRET;
let ligados = { rowCount: 0 };
if (!segredo) {
  console.log(
    "\nDOCUMENT_HASH_SECRET nao configurada: nao da para saber quem da lista ja virou cliente.",
  );
  console.log("A importacao dos dados funcionou; so essa marcacao ficou de fora.\n");
} else {
  const { createHmac } = await import("node:crypto");
  const hashes = await client.query(
    `SELECT p.id, p.cnpj FROM prospects p WHERE p.company_id IS NULL`,
  );
  const porHash = new Map(
    hashes.rows.map((linha) => [
      createHmac("sha256", segredo).update(linha.cnpj).digest("hex"),
      linha.id,
    ]),
  );
  const reivindicados = await client.query(
    `SELECT document_hash, company_id FROM trial_identity_claims WHERE company_id IS NOT NULL`,
  );
  const paraLigar = reivindicados.rows
    .map((linha) => [porHash.get(linha.document_hash), linha.company_id])
    .filter(([id]) => id);
  for (const [prospectId, companyId] of paraLigar) {
    await client.query(
      `UPDATE prospects
          SET company_id = $2,
              status = CASE WHEN status IN ('a contatar','contatado','respondeu')
                            THEN 'cadastrou' ELSE status END,
              atualizado_em = now()
        WHERE id = $1`,
      [prospectId, companyId],
    );
  }
  ligados = { rowCount: paraLigar.length };
}

const total = await client.query(
  `SELECT lado, count(*)::int n,
          count(*) FILTER (WHERE telefone <> '')::int com_tel,
          count(*) FILTER (WHERE whatsapp <> '')::int com_zap,
          count(*) FILTER (WHERE email <> '')::int com_email
     FROM prospects GROUP BY lado ORDER BY lado`,
);

console.log("--- na base agora ---");
for (const linha of total.rows) {
  console.log(
    `  ${linha.lado.padEnd(12)} ${linha.n.toLocaleString("pt-BR").padStart(8)}  ` +
      `${linha.com_tel.toLocaleString("pt-BR")} com telefone · ${linha.com_zap.toLocaleString("pt-BR")} com WhatsApp · ` +
      `${linha.com_email.toLocaleString("pt-BR")} com e-mail`,
  );
}
console.log(
  `\n${totalNovos.toLocaleString("pt-BR")} novos, ${totalAtualizados.toLocaleString("pt-BR")} atualizados.`,
);
if (ligados.rowCount) console.log(`${ligados.rowCount} ja viraram cliente e foram marcados.`);

await client.end();
process.exit(0);
