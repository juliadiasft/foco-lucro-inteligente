// A premiação de ponta a ponta: total vindo dos pedidos, conquista gravada uma
// vez só, endereço de entrega com as travas certas.
//
//   node scripts/premiacao-servidor.test.mjs      (precisa do build: npm run build)
//
// O que este teste protege:
//  - só pedido ACEITO ou CONCLUÍDO conta (enviado, recusado e cancelado não);
//  - a conquista de R$ 10 mil é gravada uma vez e NÃO some se um pedido for
//    cancelado depois;
//  - comerciante e fornecedor contam pelo lado certo;
//  - só dono/administrador informa o endereço, e ninguém mexe no dos outros.
import { readFile, readdir, rm, stat } from "node:fs/promises";
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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const PASTA = pastaPropria("premiacao-test");
const PORTA = await portaLivre();
const BANCO = path.resolve(PASTA, "central-comerciante");

let db = await PGlite.create(BANCO);
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

async function criarSessao(empresaId, nome, papel) {
  const usuario = await uma(
    `INSERT INTO users (company_id,name,email,password_hash,role,onboarding_complete)
     VALUES ($1,$2,$3,'sem-login',$4,true) RETURNING id`,
    [empresaId, nome, `${nome.toLowerCase().replace(/\W+/g, "")}@teste.local`, papel],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 day')`,
    [usuario.id, createHash("sha256").update(token).digest("hex")],
  );
  return token;
}
async function criarConta(nome, tipo) {
  const empresa = await uma(
    `INSERT INTO companies (name,account_type,plan,subscription_status,trial_ends_at)
     VALUES ($1,$2,'profissional','trialing',now()+interval '7 days') RETURNING id`,
    [nome, tipo],
  );
  return { companyId: empresa.id, token: await criarSessao(empresa.id, nome, "owner") };
}

const petshop = await criarConta("Pet Shop do Ze", "comerciante");
const operador = await criarSessao(petshop.companyId, "Operador do Ze", "operator");
const fornecedor = await criarConta("Distribuidora Racao SP", "fornecedor");
const intruso = await criarConta("Pet Shop Concorrente", "comerciante");

const pedido = async (status, total) =>
  (
    await uma(
      `INSERT INTO purchase_orders (merchant_company_id,supplier_company_id,status,total)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [petshop.companyId, fornecedor.companyId, status, total],
    )
  ).id;
// 9.000 contam (aceito + concluído); o resto NÃO conta, mesmo somando 13 mil.
await pedido("aceito", 6000);
await pedido("concluido", 3000);
await pedido("enviado", 5000);
await pedido("recusado", 4000);
await pedido("cancelado", 4000);
await db.close();

let saida = "";
let servidor = null;
async function subir() {
  servidor = spawn(process.execPath, [".output/server/index.mjs"], {
    env: { ...process.env, PORT: String(PORTA), LOCAL_DB_DIR: PASTA, DATABASE_URL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servidor.stdout.on("data", (d) => (saida += d));
  servidor.stderr.on("data", (d) => (saida += d));
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/login`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) return true;
    } catch {
      /* subindo */
    }
    await dormir(1500);
  }
  return false;
}
async function parar() {
  servidor.kill();
  for (let i = 0; i < 20 && servidor.exitCode === null; i += 1) await dormir(250);
  await dormir(500);
}
const encerrar = (codigo) => {
  servidor?.kill();
  process.exit(codigo);
};

const pastaAssets = path.resolve(".output/public/assets");
async function funcoesDe(prefixo) {
  let maisNovo = null;
  for (const nome of (await readdir(pastaAssets)).filter((n) =>
    // As funções da premiação vão no pedaço "Conquistas-*.js" (o vite as junta
    // com o componente que o Painel dos dois lados compartilha).
    new RegExp(`^(?:${prefixo}\\.functions|Conquistas)-.*\\.js$`).test(n),
  )) {
    const info = await stat(path.join(pastaAssets, nome));
    if (!maisNovo || info.mtimeMs > maisNovo.quando) maisNovo = { nome, quando: info.mtimeMs };
  }
  if (!maisNovo) {
    console.error(`Nao achei ${prefixo}.functions no build. Rode o build antes do teste.`);
    encerrar(1);
  }
  const chunk = await readFile(path.join(pastaAssets, maisNovo.nome), "utf8");
  return [...chunk.matchAll(/method:"(GET|POST)"[^"]*"([a-f0-9]{64})"/g)].map((m) => ({
    metodo: m[1],
    hash: m[2],
  }));
}

async function funcoesDoPedacoQueContem(texto) {
  for (const nome of await readdir(pastaAssets)) {
    if (!nome.endsWith(".js")) continue;
    const chunk = await readFile(path.join(pastaAssets, nome), "utf8");
    if (!chunk.includes(texto)) continue;
    return [...chunk.matchAll(/method:"(GET|POST)"[^"]*"([a-f0-9]{64})"/g)].map((m) => ({
      metodo: m[1],
      hash: m[2],
    }));
  }
  return [];
}

const raizPnpm = path.resolve("node_modules/.pnpm");
const pastaSeroval = (await readdir(raizPnpm)).find((n) => /^seroval@/.test(n));
const { toJSONAsync } = await import(
  pathToFileURL(path.join(raizPnpm, pastaSeroval, "node_modules/seroval/dist/index.js")).href
);

async function chamar({ hash, metodo }, token, corpo) {
  const cabecalhos = {
    "x-tsr-serverFn": "true",
    Origin: `http://localhost:${PORTA}`,
    Referer: `http://localhost:${PORTA}/conquistas`,
    Cookie: token.startsWith("staff:")
      ? `central_staff_session=${token.slice(6)}`
      : `central_session=${token}`,
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
const deuErro = (r) => r.status !== 200 || r.texto.includes("$TSR/Error");

const funcoes = await funcoesDe("premiacao");
const funcoesAdm = await funcoesDoPedacoQueContem("Entrega dos mascotinhos");
const listarAdm = funcoesAdm.find((f) => f.metodo === "GET");
const marcarAdm = funcoesAdm.find((f) => f.metodo === "POST");
const ler = funcoes.find((f) => f.metodo === "GET");
const gravar = funcoes.find((f) => f.metodo === "POST");
if (!ler || !gravar) {
  console.error("Funcoes da premiacao nao encontradas no build: " + JSON.stringify(funcoes));
  encerrar(1);
}

const endereco = {
  degrau: 10_000,
  destinatario: "Ze da Silva",
  telefone: "(19) 99999-0000",
  cep: "13010-000",
  logradouro: "Rua das Flores",
  numero: "120",
  bairro: "Centro",
  cidade: "Campinas",
  uf: "sp",
};

if (!(await subir())) {
  console.error("O servidor nao subiu.\n" + saida.slice(-600));
  encerrar(1);
}

console.log("--- abaixo de R$ 10 mil: só pedido aceito ou concluído conta ---");
let r = await chamar(ler, petshop.token);
ok(!deuErro(r), "o comerciante abre a tela de conquistas");
ok(r.texto.includes("9000"), "total = 9.000 (aceito + concluído), sem enviado/recusado/cancelado");
await parar();
db = await PGlite.create(BANCO);
ok(
  (await uma("SELECT count(*)::int n FROM conquistas WHERE company_id=$1", [petshop.companyId]))
    .n === 0,
  "nenhuma conquista gravada com 9 mil",
);
const extra = await pedido("concluido", 2000);
await db.close();

console.log("--- passou de R$ 10 mil ---");
ok(await subir(), "o servidor volta a subir");
r = await chamar(ler, petshop.token);
ok(!deuErro(r) && r.texto.includes("11000"), "total = 11.000");
ok(r.texto.includes("pendente"), "a conquista chega com a entrega pendente");
r = await chamar(ler, petshop.token);
ok(!deuErro(r), "abrir de novo não dá erro");
await parar();
db = await PGlite.create(BANCO);
const linhas = (await db.query("SELECT * FROM conquistas WHERE company_id=$1", [petshop.companyId]))
  .rows;
ok(linhas.length === 1 && linhas[0].degrau === 10000, "gravada uma vez só, no degrau de 10 mil");
ok(linhas[0].entrega_status === "pendente", "status de entrega: pendente");
// O pedido cancelado depois NÃO tira a conquista.
await db.query("UPDATE purchase_orders SET status='cancelado' WHERE id=$1", [extra]);
await db.close();

console.log("--- pedido cancelado depois: a conquista fica ---");
ok(await subir(), "o servidor volta a subir");
r = await chamar(ler, petshop.token);
ok(!deuErro(r) && r.texto.includes("9000"), "total cai para 9.000");
ok(r.texto.includes("pendente"), "mas a conquista continua registrada");

console.log("--- endereço de entrega ---");
r = await chamar(gravar, operador, endereco);
ok(deuErro(r), "operador (nem dono nem admin) NÃO informa o endereço");
r = await chamar(gravar, petshop.token, { ...endereco, cep: "123" });
ok(deuErro(r), "CEP inválido é recusado");
r = await chamar(gravar, intruso.token, endereco);
ok(deuErro(r), "quem não conquistou não consegue gravar endereço");
r = await chamar(gravar, petshop.token, { ...endereco, degrau: 50000 });
ok(deuErro(r), "degrau sem prêmio físico não aceita endereço");
r = await chamar(gravar, petshop.token, endereco);
ok(!deuErro(r), "o dono informa o endereço");
await parar();
db = await PGlite.create(BANCO);
const gravada = await uma(
  "SELECT entrega_status, cidade, uf FROM conquistas WHERE company_id=$1 AND degrau=10000",
  [petshop.companyId],
);
ok(gravada.entrega_status === "endereco_enviado", "status vira endereço enviado");
ok(gravada.uf === "SP" && gravada.cidade === "Campinas", "UF guardada em maiúsculas");
// Depois que sai para entrega, não muda mais.
await db.query("UPDATE conquistas SET entrega_status='enviado' WHERE company_id=$1", [
  petshop.companyId,
]);
await db.close();
ok(await subir(), "o servidor volta a subir");
r = await chamar(gravar, petshop.token, { ...endereco, numero: "999" });
ok(deuErro(r), "depois de enviado, o endereço não muda");
await parar();

console.log("--- o fornecedor conta pelo lado dele ---");
db = await PGlite.create(BANCO);
await pedido("concluido", 2000); // volta a 11 mil para os dois lados
await db.close();
ok(await subir(), "o servidor volta a subir");
r = await chamar(ler, fornecedor.token);
ok(!deuErro(r) && r.texto.includes("11000"), "fornecedor vê 11.000 vendidos");
r = await chamar(ler, intruso.token);
ok(!deuErro(r) && !r.texto.includes("11000"), "quem não tem pedido não vê o total dos outros");
await parar();
db = await PGlite.create(BANCO);
ok(
  (await uma("SELECT count(*)::int n FROM conquistas WHERE company_id=$1", [fornecedor.companyId]))
    .n === 1,
  "o fornecedor também ganhou o degrau de 10 mil",
);
ok(
  (await uma("SELECT count(*)::int n FROM conquistas WHERE company_id=$1", [intruso.companyId]))
    .n === 0,
  "e o intruso não ganhou nada",
);
await db.close();

console.log("--- back office: fila de entrega ---");
db = await PGlite.create(BANCO);
const staffToken = async (papel) => {
  const u = await uma(
    `INSERT INTO staff_users (name,email,password_hash,role) VALUES ($1,$2,'sem-login',$3) RETURNING id`,
    [`Equipe ${papel}`, `${papel}@central.local`, papel],
  );
  const t = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO staff_sessions (token_hash,staff_id,expires_at) VALUES ($1,$2,now()+interval '1 day')`,
    [createHash("sha256").update(t).digest("hex"), u.id],
  );
  return "staff:" + t;
};
const suporte = await staffToken("suporte");
const financeiro = await staffToken("financeiro");
// O fornecedor informa o endereço (simulado no banco); o do pet shop já está 'enviado'.
await db.query(
  `UPDATE conquistas SET entrega_status='endereco_enviado', destinatario='Ana', telefone='11 98888-0000',
     cep='01001-000', logradouro='Rua A', numero='1', bairro='Sé', cidade='São Paulo', uf='SP'
   WHERE company_id=$1`,
  [fornecedor.companyId],
);
await db.close();
ok(await subir(), "o servidor volta a subir");
r = await chamar(listarAdm, financeiro);
ok(deuErro(r), "financeiro NÃO vê a fila de entrega");
r = await chamar(listarAdm, petshop.token);
ok(deuErro(r), "cliente logado (sem ser da equipe) NÃO vê a fila");
r = await chamar(listarAdm, suporte);
ok(
  !deuErro(r) && r.texto.includes("Distribuidora Racao SP") && r.texto.includes("Rua A"),
  "suporte vê a fila com empresa e endereço",
);
ok(r.texto.includes("Pet Shop do Ze"), "e vê também quem já está a caminho");
const idF = fornecedor.companyId;
r = await chamar(marcarAdm, suporte, { empresaId: idF, degrau: 10000, para: "entregue" });
ok(deuErro(r), "não pula etapa: endereço recebido → entregue é recusado");
r = await chamar(marcarAdm, financeiro, { empresaId: idF, degrau: 10000, para: "enviado" });
ok(deuErro(r), "financeiro não marca entrega");
r = await chamar(marcarAdm, suporte, { empresaId: idF, degrau: 10000, para: "enviado" });
ok(!deuErro(r), "suporte marca como enviado");
r = await chamar(marcarAdm, suporte, { empresaId: idF, degrau: 10000, para: "enviado" });
ok(deuErro(r), "marcar enviado duas vezes é recusado");
r = await chamar(marcarAdm, suporte, { empresaId: idF, degrau: 10000, para: "entregue" });
ok(!deuErro(r), "suporte marca como entregue");
r = await chamar(marcarAdm, suporte, {
  empresaId: intruso.companyId,
  degrau: 10000,
  para: "enviado",
});
ok(deuErro(r), "conquista que não existe é recusada");
await parar();
db = await PGlite.create(BANCO);
ok(
  (await uma("SELECT entrega_status s FROM conquistas WHERE company_id=$1", [idF])).s ===
    "entregue",
  "no banco: entregue",
);
ok(
  (await uma("SELECT count(*)::int n FROM staff_audit_log WHERE action='premio_entrega'")).n === 2,
  "as duas marcações ficaram na auditoria",
);
await db.close();

if (falhas.length) mostrarFalhas();
function mostrarFalhas() {
  const linhasDeErro = saida.split("\n").filter((l) => /Error|error:/i.test(l));
  if (linhasDeErro.length)
    console.error("\nErro no servidor:\n  " + linhasDeErro.slice(0, 6).join("\n  "));
}

await rm(PASTA, { recursive: true, force: true });
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
