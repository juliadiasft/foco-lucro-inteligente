// Lê os segredos de operação de um arquivo local para dentro do process.env.
//
// Serve para os scripts de manutenção que rodam na máquina de quem opera —
// importar prospecção, migrar — pararem de exigir que a pessoa cole a URL do
// banco no terminal toda vez. Colar a URL é o pior jeito: ela carrega a senha
// do banco junto e fica no histórico do terminal.
//
// O arquivo se chama segredos.local, e o nome não é capricho. O .env seria o
// lugar óbvio, mas o Vite carrega .env sozinho ao subir o servidor de
// desenvolvimento: guardar a URL do banco de produção ali faria um `pnpm dev`
// na máquina de casa conectar no banco dos clientes sem ninguém pedir. O Vite
// só olha arquivos que começam com .env, então este passa longe.
//
// Ele é ignorado pelo git (a regra *.local no .gitignore), então o que estiver
// dentro não vai para o repositório. No servidor o arquivo não existe e nada
// acontece: lá as variáveis vêm do ambiente do próprio Render.
//
// O que já estiver definido no ambiente ganha do arquivo. Assim dá para
// sobrescrever pontualmente sem editar o arquivo — útil para apontar um script
// para outro banco por uma rodada só.
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export async function lerEnv(arquivo = "segredos.local") {
  let bruto;
  try {
    bruto = await readFile(path.resolve(arquivo), "utf8");
  } catch {
    return { lidas: 0, existe: false };
  }

  // O PowerShell grava esses arquivos com uma marca invisível no começo (BOM).
  // Sem tirar, a primeira variável do arquivo vira "﻿DATABASE_URL", que
  // não é o nome que ninguém procura — e o script insiste que a URL não foi
  // configurada mesmo com ela ali, escrita, na primeira linha.
  const semMarca = bruto.replace(/^﻿/, "");

  let lidas = 0;
  for (const linha of semMarca.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 1) continue;
    const nome = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    // Aspas em volta são hábito de quem copia de outro lugar, e não fazem
    // parte do valor. Uma URL de banco com aspas dentro não conecta.
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[nome] === undefined) {
      process.env[nome] = valor;
      lidas += 1;
    }
  }
  return { lidas, existe: true };
}
