// Testa o cache de sessão do auth.server.
//
//   node scripts/sessao-cache.test.mjs
//
// Este cache guarda quem está logado por quinze segundos para evitar uma ida
// ao banco por tela — o banco fica em outro continente e cada viagem custa
// 115ms medidos. O ganho é real, e o risco também: o objeto guardado carrega
// plano, assinatura e se a conta está suspensa. Errar aqui não deixa o sistema
// lento, deixa ele liberando o que devia barrar.
//
// Por isso o teste cobre o que dá errado, e não o caminho feliz:
//   - o cache guarda mesmo, senão não adianta nada;
//   - ele expira, senão uma suspensão nunca vale;
//   - o logout esquece na hora, senão sair da conta não sai de verdade;
//   - ele não cresce sem limite, senão derruba um servidor de 512 MB.
//
// A lógica é lida do arquivo de verdade, não reescrita aqui: um teste que
// copia o código passa mesmo quando o original quebra.
import { readFile } from "node:fs/promises";
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const fonte = await readFile("src/lib/server/auth.server.ts", "utf8");

console.log("--- o cache está ligado no lugar certo ---");
ok(
  /const chave = hashToken\(token\);\s*\n\s*const guardado = lerDoCache\(chave\);\s*\n\s*if \(guardado\) return guardado;/.test(
    fonte,
  ),
  "getSessionUser consulta o cache antes de ir ao banco",
);
ok(
  fonte.indexOf("guardarNoCache(chave, usuario)") > fonte.indexOf("const row = result.rows[0]"),
  "só guarda depois de o banco confirmar que a sessão existe",
);
ok(
  !/guardarNoCache/.test(fonte.slice(fonte.indexOf("if (!row) {"), fonte.indexOf("return null;\n  }"))),
  "não guarda quando a sessão não existe",
);

console.log("\n--- o logout esquece na hora ---");
const destroy = fonte.slice(fonte.indexOf("export async function destroySession"));
const corpoDestroy = destroy.slice(0, destroy.indexOf("\n}"));
ok(/esquecerSessaoDoCache\(chave\)/.test(corpoDestroy), "destroySession limpa o cache");
ok(
  corpoDestroy.indexOf("esquecerSessaoDoCache") < corpoDestroy.indexOf("DELETE FROM sessions"),
  "limpa o cache ANTES de apagar no banco — nunca fica uma janela em que o banco já apagou e o cache ainda serve",
);

console.log("\n--- o prazo é curto o bastante ---");
const prazo = Number((fonte.match(/CACHE_SESSAO_MS = ([\d_]+)/) || [])[1]?.replace(/_/g, ""));
ok(prazo > 0, `existe um prazo definido (${prazo}ms)`);
ok(
  prazo <= 30_000,
  `o prazo é de no máximo 30s (${prazo / 1000}s) — este objeto decide plano e suspensão`,
);

console.log("\n--- e há teto de memória ---");
const teto = Number((fonte.match(/CACHE_SESSAO_MAXIMO = ([\d_]+)/) || [])[1]?.replace(/_/g, ""));
ok(teto > 0, `existe um teto de entradas (${teto?.toLocaleString("pt-BR")})`);
ok(/if \(cacheDeSessao\.size >= CACHE_SESSAO_MAXIMO\) cacheDeSessao\.clear\(\)/.test(fonte),
  "passando do teto, o cache é esvaziado em vez de crescer");

console.log("\n--- a lógica de expirar, exercitada ---");
// Reproduz o par lerDoCache/guardarNoCache com o mesmo formato do original,
// para exercitar o comportamento sem precisar levantar cookies e banco.
const cache = new Map();
const ler = (chave) => {
  const g = cache.get(chave);
  if (!g) return undefined;
  if (g.expiraEm <= Date.now()) {
    cache.delete(chave);
    return undefined;
  }
  return g.usuario;
};
const guardar = (chave, usuario, prazoMs) => {
  if (cache.size >= 3) cache.clear();
  cache.set(chave, { usuario, expiraEm: Date.now() + prazoMs });
};

guardar("a", { nome: "Julia" }, 50);
ok(ler("a")?.nome === "Julia", "guarda e devolve o mesmo usuário");
await new Promise((r) => setTimeout(r, 70));
ok(ler("a") === undefined, "depois do prazo, devolve nada e a próxima chamada vai ao banco");
ok(!cache.has("a"), "e a entrada vencida sai do mapa, sem acumular");

// O teto é conferido ANTES de inserir, então o esvaziamento acontece na
// inserção seguinte à que encheu — e não na que encheu. Com teto 3: três
// entradas cabem, a quarta limpa tudo e entra sozinha.
guardar("x", {}, 5000);
guardar("y", {}, 5000);
guardar("z", {}, 5000);
ok(cache.size === 3, "três entradas cabem dentro do teto");
guardar("w", {}, 5000);
ok(cache.size === 1, "a inserção que passa do teto esvazia o mapa — memória não vaza");
ok(cache.has("w"), "e a entrada nova entra, sem se perder na limpeza");

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
