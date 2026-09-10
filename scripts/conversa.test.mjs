// A conversa entre comerciante e fornecedor, testada de ponta a ponta.
//
//   node scripts/conversa.test.mjs
//
// É o teste mais caro de pular. A Julia mandou dez mensagens e cinco
// responderam: em dias esses fornecedores vão publicar vitrine e um pet shop
// vai escrever para eles. Se a mensagem não chegar, ninguém reclama — o
// comerciante só acha que o fornecedor ignorou, e some.
//
// O teste sobe o servidor de verdade, cria as contas, e faz a mensagem
// atravessar: comerciante escreve, fornecedor lê e responde, comerciante lê a
// resposta. E confere o que ninguém percebe até dar errado — que a conversa de
// uma empresa não aparece para outra.
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

import { PGlite } from "@electric-sql/pglite";

import { pastaPropria, portaLivre } from "./porta-e-pasta.mjs";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const PASTA = pastaPropria("conversa-test");
const PORTA = await portaLivre();

// --- prepara o banco do jeito que o servidor espera encontrar ---
//
// Duas armadilhas aqui, e as duas custaram uma tarde.
//
// A primeira é o nome da pasta: o servidor abre `central-comerciante` dentro
// de LOCAL_DB_DIR. Criar o banco com outro nome faz ele subir num banco vazio,
// e aí o teste testa o nada.
//
// A segunda é o registro: o servidor roda as migrações que ainda não estão em
// app_migrations. Aplicar os arquivos sem registrar faz ele aplicar tudo de
// novo, e a segunda passada morre em "constraint already exists" — derrubando
// as telas com um erro que parece defeito do produto e não é.
const db = await PGlite.create(path.resolve(PASTA, "central-comerciante"));
await db.exec(
  `CREATE TABLE IF NOT EXISTS app_migrations (
     name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
);
const dir = path.resolve("migrations");
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
  await db.query("INSERT INTO app_migrations (name) VALUES ($1)", [arquivo]);
}
const uma = async (sql, p = []) => (await db.query(sql, p)).rows[0];

/** Cria empresa, usuário e sessão. Devolve o token do cookie. */
async function criarConta(nome, tipo) {
  const empresa = await uma(
    `INSERT INTO companies (name,account_type,plan,subscription_status,trial_ends_at)
     VALUES ($1,$2,'profissional','trialing',now()+interval '7 days') RETURNING id`,
    [nome, tipo],
  );
  const usuario = await uma(
    `INSERT INTO users (company_id,name,email,password_hash,role,onboarding_complete)
     VALUES ($1,$2,$3,'sem-login','owner',true) RETURNING id`,
    [empresa.id, nome, `${nome.toLowerCase().replace(/\W+/g, "")}@teste.local`],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 day')`,
    [usuario.id, createHash("sha256").update(token).digest("hex")],
  );
  return { companyId: empresa.id, token };
}

const petshop = await criarConta("Pet Shop do Ze", "comerciante");
const fornecedor = await criarConta("Distribuidora Racao SP", "fornecedor");
const intruso = await criarConta("Pet Shop Concorrente", "comerciante");

// O fornecedor só pode ser procurado se a vitrine estiver publicada — é a
// regra do próprio sendMessage.
await db.query(
  `INSERT INTO supplier_profiles (company_id,display_name,published,slug)
   VALUES ($1,'Distribuidora Racao SP',true,'distribuidora-racao-sp')`,
  [fornecedor.companyId],
);
await db.close();

// --- sobe o servidor apontando para este banco ---
const servidor = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...process.env, PORT: String(PORTA), LOCAL_DB_DIR: PASTA, DATABASE_URL: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let saida = "";
servidor.stdout.on("data", (d) => (saida += d));
servidor.stderr.on("data", (d) => (saida += d));

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const encerrar = (codigo) => {
  servidor.kill();
  process.exit(codigo);
};

let noAr = false;
for (let i = 0; i < 40 && !noAr; i += 1) {
  try {
    noAr = (await fetch(`http://localhost:${PORTA}/login`, { signal: AbortSignal.timeout(2000) }))
      .ok;
  } catch {
    /* ainda subindo */
  }
  if (!noAr) await dormir(1500);
}
if (!noAr) {
  console.error("O servidor nao subiu.\n" + saida.slice(-600));
  encerrar(1);
}

// --- descobre o endereço de cada função ---
//
// As funções do servidor são endereçadas por um hash. Os hashes ficam num
// pedaço do código que o navegador baixa: `conversations.functions-*.js`.
//
// Ler TODOS os arquivos de código procurando hash não funciona, e essa foi a
// hora perdida aqui: a pasta guarda o resultado de builds antigos junto com o
// atual — hoje são seis cópias de `conversas`, quatro de `ConversationsView` —
// então a busca ampla devolve endereços de outras telas e de versões velhas. O
// arquivo mais recente com o nome certo é o único que vale.
const pastaAssets = path.resolve(".output/public/assets");
const candidatos = (await readdir(pastaAssets)).filter((n) =>
  /^conversations\.functions-.*\.js$/.test(n),
);
if (!candidatos.length) {
  console.error("Nao achei conversations.functions no build. Rode o build antes do teste.");
  encerrar(1);
}
let maisNovo = null;
for (const nome of candidatos) {
  const info = await stat(path.join(pastaAssets, nome));
  if (!maisNovo || info.mtimeMs > maisNovo.quando) maisNovo = { nome, quando: info.mtimeMs };
}
const chunk = await readFile(path.join(pastaAssets, maisNovo.nome), "utf8");
// Cada função aparece como method + o hash do handler. O método separa a
// listagem (GET) das outras três (POST).
const registradas = [...chunk.matchAll(/method:"(GET|POST)"[^"]*"([a-f0-9]{64})"/g)].map((m) => ({
  metodo: m[1],
  hash: m[2],
}));
console.log(`(${maisNovo.nome}: ${registradas.length} funções de conversa)\n`);
if (registradas.length < 3) {
  console.error("O código das conversas mudou de formato — o teste não sabe mais o que chamar.");
  encerrar(1);
}

// --- como falar com uma função do servidor ---
//
// Três coisas que o teste anterior não fazia e por isso batia em erro:
//
// 1. O corpo não é JSON puro. O TanStack serializa com Seroval (formato que
//    sabe carregar Date, Map, undefined — coisas que JSON perde) e recusa o
//    resto com SerovalDeserializationError.
// 2. Sem o cabeçalho x-tsr-serverFn a chamada não é tratada como função.
// 3. Sem Origin/Referer do mesmo endereço a proteção contra CSRF responde 403.
//
// O seroval não é dependência direta do projeto: vem por baixo do TanStack.
// Por isso é procurado em vez de importado pelo nome.
const raizPnpm = path.resolve("node_modules/.pnpm");
const pastaSeroval = (await readdir(raizPnpm)).find((n) => /^seroval@/.test(n));
if (!pastaSeroval) {
  console.error("Nao achei o seroval em node_modules — sem ele nao da para montar o corpo.");
  encerrar(1);
}
const { toJSONAsync } = await import(
  pathToFileURL(path.join(raizPnpm, pastaSeroval, "node_modules/seroval/dist/index.js")).href
);

/** Chama uma função do servidor com a sessão de uma das contas. */
async function chamar({ hash, metodo }, token, corpo) {
  const cabecalhos = {
    "x-tsr-serverFn": "true",
    Origin: `http://localhost:${PORTA}`,
    Referer: `http://localhost:${PORTA}/conversas`,
    Cookie: `central_session=${token}`,
  };
  let body;
  if (metodo === "POST") {
    cabecalhos["Content-Type"] = "application/json";
    body = JSON.stringify(await toJSONAsync({ data: corpo }));
  }
  const r = await fetch(`http://localhost:${PORTA}/_serverFn/${hash}`, {
    method: metodo,
    headers: cabecalhos,
    body,
  });
  return { status: r.status, texto: await r.text() };
}

// A resposta também vem serializada. Só interessa saber se deu erro e o que o
// texto contém, então basta procurar a marca de erro que o TanStack usa.
const deuErro = (r) => r.status !== 200 || r.texto.includes("$TSR/Error");

const listar = registradas.find((f) => f.metodo === "GET");
const posts = registradas.filter((f) => f.metodo === "POST");

// --- o comerciante escreve para o fornecedor ---
//
// Qual dos POST é o "enviar" é descoberto enviando de verdade: é o único que
// aceita {supplierCompanyId, body} e devolve o número da conversa. Descobrir
// por comportamento em vez de por posição mantém o teste válido quando o
// arquivo for reordenado.
console.log("--- o comerciante escreve para o fornecedor ---");
const PERGUNTA = "Bom dia! Qual o preco da racao Golden 15kg e o pedido minimo?";
let enviar = null;
let conversaId = null;
for (const funcao of posts) {
  const r = await chamar(funcao, petshop.token, {
    supplierCompanyId: fornecedor.companyId,
    body: PERGUNTA,
  });
  const id =
    !deuErro(r) && r.texto.includes("conversationId")
      ? r.texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0]
      : null;
  if (id) {
    enviar = funcao;
    conversaId = id;
    break;
  }
}
ok(Boolean(enviar), "a mensagem do comerciante é aceita pelo servidor");
ok(Boolean(conversaId), `a conversa é criada (${String(conversaId).slice(0, 8)}...)`);
if (!enviar) {
  const linhas = saida.split("\n").filter((l) => /Error|error:/i.test(l));
  if (linhas.length) console.error("\nErro no servidor:\n  " + linhas.slice(0, 6).join("\n  "));
  encerrar(1);
}

console.log("\n--- o fornecedor RECEBE a mensagem ---");
const caixa = await chamar(listar, fornecedor.token, undefined);
ok(!deuErro(caixa), `a caixa de entrada do fornecedor abre (HTTP ${caixa.status})`);
ok(caixa.texto.includes(conversaId), "a conversa está lá");
ok(caixa.texto.includes("Pet Shop do Ze"), "identificada pelo nome de quem escreveu");
ok(caixa.texto.includes(PERGUNTA.slice(0, 30)), "com a última mensagem à mostra");
ok(
  /"unread"\]?,"v":\[[^\]]*\{"t":0,"s":[1-9]/.test(caixa.texto) || caixa.texto.includes('"s":1'),
  "e marcada como não lida",
);

// Qual POST é o "abrir conversa": aceita {id} e devolve as mensagens.
let abrir = null;
for (const funcao of posts) {
  if (funcao.hash === enviar.hash) continue;
  const r = await chamar(funcao, fornecedor.token, { id: conversaId });
  if (!deuErro(r) && r.texto.includes("messages") && r.texto.includes(PERGUNTA)) {
    abrir = funcao;
    break;
  }
}
ok(Boolean(abrir), "o fornecedor ABRE a conversa e lê a pergunta inteira");

console.log("\n--- o fornecedor RESPONDE, e a resposta volta ---");
const PRECO = "Bom dia! Golden 15kg sai a R$ 92,00, pedido minimo 10 unidades.";
const resposta = await chamar(enviar, fornecedor.token, {
  conversationId: conversaId,
  body: PRECO,
});
ok(!deuErro(resposta), `o fornecedor consegue responder (HTTP ${resposta.status})`);
if (deuErro(resposta)) console.error(`        ${resposta.texto.slice(0, 300)}`);

if (abrir) {
  const vista = await chamar(abrir, petshop.token, { id: conversaId });
  ok(!deuErro(vista) && vista.texto.includes(PRECO), "o comerciante LÊ a resposta do fornecedor");
  ok(
    vista.texto.includes(PERGUNTA) && vista.texto.includes(PRECO),
    "as duas mensagens estão na mesma conversa",
  );
}

console.log("\n--- e a conversa dos outros continua sendo dos outros ---");
// O teste que ninguém faz e que, quando falha, entrega negociação de preço de
// um pet shop para o concorrente da esquina.
if (abrir) {
  const espiada = await chamar(abrir, intruso.token, { id: conversaId });
  ok(!espiada.texto.includes(PRECO), "outra empresa NÃO consegue ler esta conversa");
}
const caixaDoIntruso = await chamar(listar, intruso.token, undefined);
ok(
  !caixaDoIntruso.texto.includes("Distribuidora Racao SP"),
  "e ela não aparece na caixa de quem não participa",
);
const invasao = await chamar(enviar, intruso.token, {
  conversationId: conversaId,
  body: "Escrevendo na conversa dos outros",
});
ok(deuErro(invasao), "outra empresa NÃO consegue escrever nesta conversa");

console.log("\n--- o fornecedor não sai abordando quem não o procurou ---");
const abordagem = await chamar(enviar, fornecedor.token, {
  supplierCompanyId: petshop.companyId,
  body: "Oi, quer comprar de mim?",
});
ok(deuErro(abordagem), "fornecedor não consegue abrir conversa do nada");

servidor.kill();
await dormir(500);
await rm(PASTA, { recursive: true, force: true });
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
