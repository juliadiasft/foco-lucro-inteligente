// Apaga o resultado do build anterior antes de gerar o novo.
//
// Roda sozinho, como primeiro passo do `pnpm build`.
//
// Sem isto a pasta vira um museu: o Vite dá a cada arquivo um nome com a
// impressão digital do conteúdo, então cada build cria nomes novos e deixa os
// velhos onde estavam. Aqui chegou a 600 arquivos — 47 cópias de `index`, 8 de
// `conversas` — de builds de semanas diferentes convivendo na mesma pasta.
//
// O navegador não se confunde com isso, porque só carrega o que o HTML novo
// manda carregar. Quem se confunde é quem lê a pasta: um teste que procura o
// código de uma tela encontra oito versões dela e não tem como saber qual está
// no ar. Foi exatamente o que aconteceu com o teste das conversas, que passou
// horas lendo o endereço errado das funções do servidor.
//
// No servidor isto não muda nada: lá o build roda num container novo, e o
// .dockerignore já impede a pasta local de ser copiada para dentro dele. Esta
// limpeza é para a máquina de quem desenvolve.
import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PASTA = path.resolve(".output");

try {
  await rm(PASTA, { recursive: true, force: true });
  console.log("build anterior apagado");
} catch (erro) {
  // No Windows um arquivo aberto — um servidor local ainda rodando sobre este
  // build — segura a pasta. Avisar e seguir é melhor do que abortar o build:
  // o Vite vai sobrescrever o que conseguir, e o pior caso é continuar com a
  // sujeira que já estava lá.
  console.warn(`nao consegui apagar ${PASTA}: ${erro.message}`);
  console.warn("se houver um servidor local rodando, pare ele e rode de novo.");
  process.exitCode = 0;
}
