// Confere se o standalone-update.tar.gz está de acordo com o repositório.
//
//   node scripts/archive-check.mjs
//
// Por que isto existe:
//
// O Dockerfile faz `COPY . .` e logo depois extrai o standalone-update.tar.gz
// por cima. Quem está dentro do archive ganha do repositório — sempre, e sem
// aviso nenhum.
//
// Em 08/09/2026 isso engoliu duas entregas de uma vez. O autopreenchimento do
// cadastro pelo CNPJ e a cobrança anual foram escritos, testados, aprovados e
// empurrados; o build passou, o site subiu, e as duas coisas simplesmente não
// estavam lá. Cinco arquivos do repositório tinham cópias velhas dentro do
// archive, e a cópia velha venceu no build.
//
// O jeito de descobrir isso foi abrir a tela em produção e reparar num texto
// de ajuda antigo. Não dá para depender disso.
//
// Regra: todo arquivo que existe nos dois lugares tem que ser idêntico. Quando
// diferir, é porque alguém editou o repositório e esqueceu do archive — e o
// conserto é regerar:
//
//   tar -tzf standalone-update.tar.gz | sort > /tmp/lista.txt
//   tar -czf standalone-update.tar.gz --owner=0 --group=0 --numeric-owner -T /tmp/lista.txt
//
// O --owner=0 --group=0 importa: o tar do Windows grava o uid da máquina
// (197609), que não existe dentro do container e derrubava o build inteiro.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ARCHIVE = "standalone-update.tar.gz";

if (!existsSync(ARCHIVE)) {
  console.error(`Não achei o ${ARCHIVE}. Rode a partir da raiz do repositório.`);
  process.exit(1);
}

const lista = execFileSync("tar", ["-tzf", ARCHIVE], { encoding: "utf8" })
  .split("\n")
  .map((linha) => linha.trim())
  .filter((linha) => linha && !linha.endsWith("/"));

// Caminho relativo, dentro do próprio projeto: o tar do Git Bash no Windows
// não abre um destino no formato "C:\Users\...", que é o que o temp do sistema
// devolve por lá.
const destino = "node_modules/.cache/archive-check";
try {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  execFileSync("tar", ["-xzf", ARCHIVE, "-C", destino, "--no-same-owner"]);

  const divergentes = [];
  const ausentes = [];

  for (const arquivo of lista) {
    const noArchive = path.join(destino, arquivo);
    if (!existsSync(arquivo)) {
      ausentes.push(arquivo);
      continue;
    }
    if (!readFileSync(noArchive).equals(readFileSync(arquivo))) divergentes.push(arquivo);
  }

  console.log(`${lista.length} arquivo(s) no archive.`);

  if (ausentes.length) {
    console.log(`\n${ausentes.length} existe(m) só no archive (some(m) do repositório):`);
    for (const arquivo of ausentes) console.log(`  ${arquivo}`);
  }

  if (divergentes.length) {
    console.log(`\n${divergentes.length} DIVERGENTE(S) — o build vai usar a versão do archive:`);
    for (const arquivo of divergentes) console.log(`  ${arquivo}`);
    console.log("\nRegere o archive antes de subir, senão essas mudanças não vão para o ar.");
    process.exit(1);
  }

  if (!ausentes.length) console.log("Archive e repositório batem. Nada será sobrescrito no build.");
  process.exit(0);
} finally {
  rmSync(destino, { recursive: true, force: true });
}
