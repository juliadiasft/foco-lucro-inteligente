// Roda todos os testes e diz, em uma tela, se dá para dormir tranquila.
//
//   pnpm test
//
// Um por vez, de propósito. Vários testes sobem o servidor de verdade numa
// porta fixa e criam um banco local próprio; rodando em paralelo eles brigam
// pela porta e um derruba o banco do outro, e o teste falha por motivo que não
// tem nada a ver com o sistema.
//
// Os testes que precisam de internet (a consulta de CNPJ na Receita) avisam
// quando ela falta, em vez de acusar defeito no sistema.
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const pasta = path.resolve("scripts");
const arquivos = (await readdir(pasta)).filter((n) => n.endsWith(".test.mjs")).sort();

// Rodar isto em duas janelas ao mesmo tempo é seguro: cada teste que sobe
// servidor pega uma porta livre e uma pasta de banco com o número do próprio
// processo no nome (scripts/porta-e-pasta.mjs). Antes não era — um terminava,
// apagava a pasta, e o outro morria dizendo que a tabela companies não existe.

const resultados = [];
const comeco = Date.now();

for (const arquivo of arquivos) {
  // Pontos em vez de espaços: alguns terminais comem espaços seguidos e o
  // nome cola no resultado ("acessook — 17 verificações").
  const nome = arquivo.replace(".test.mjs", "");
  process.stdout.write(`${nome} ${".".repeat(Math.max(3, 32 - nome.length))} `);
  const saida = await new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(pasta, arquivo)], { stdio: ["ignore", "pipe", "pipe"] });
    let texto = "";
    p.stdout.on("data", (d) => (texto += d));
    p.stderr.on("data", (d) => (texto += d));
    p.on("close", (codigo) => resolve({ codigo, texto }));
  });

  const verificacoes = (saida.texto.match(/^ {2}ok {2}/gm) || []).length;
  const quebrou = (saida.texto.match(/^ FALHA {2}(.+)$/gm) || []).map((l) => l.replace(/^ FALHA {2}/, ""));
  resultados.push({ arquivo, ok: saida.codigo === 0, verificacoes, quebrou, texto: saida.texto });
  console.log(saida.codigo === 0 ? `ok — ${verificacoes} verificações` : `FALHOU`);
  for (const f of quebrou) console.log(`     ${f}`);
}

const segundos = Math.round((Date.now() - comeco) / 1000);
const passaram = resultados.filter((r) => r.ok).length;
const total = resultados.reduce((soma, r) => soma + r.verificacoes, 0);

console.log(`\n${passaram} de ${resultados.length} arquivos, ${total} verificações, ${segundos}s`);

const falhos = resultados.filter((r) => !r.ok);
if (falhos.length) {
  // O relatório mostra a saída inteira só de quem quebrou: é o que a pessoa
  // precisa ler, e enterrar isso no meio do que passou faz ela rolar a tela
  // procurando.
  for (const r of falhos) {
    console.log(`\n===== ${r.arquivo} =====\n${r.texto.trim()}`);
  }
  process.exit(1);
}
console.log("Está tudo passando.");
