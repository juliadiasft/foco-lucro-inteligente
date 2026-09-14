// O dinheiro combinado num pedido tem de aparecer — e desaparecer — nas contas.
//
//   node scripts/pedidos.test.mjs
//
// Dois defeitos de 14/09/2026, os dois invisíveis na tela de pedidos e só
// visíveis semanas depois, no financeiro:
//
// 1. Orçamento fechado virava pedido "Aguardando o fornecedor". O fornecedor
//    tinha de aceitar de novo o preço que ele mesmo negociou, e como as contas
//    a pagar e a receber só nascem no aceite, o negócio fechado não entrava no
//    financeiro de ninguém.
// 2. Pedido cancelado depois de aceito deixava as duas contas de pé, cobrando
//    mercadoria que não ia chegar.
//
// O teste sobe o servidor de verdade e faz os caminhos pelas funções que as
// telas chamam. Confere também os cuidados: pedido com pagamento registrado
// mantém as contas, e ninguém mexe no pedido dos outros.
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

const PASTA = pastaPropria("pedidos-test");
const PORTA = await portaLivre();
const BANCO = path.resolve(PASTA, "central-comerciante");

// --- banco com as migrações registradas (ver conversa.test.mjs) ---
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

// Pedidos já enviados, como a tela de comprar deixa.
const novoPedido = async (total) =>
  (
    await uma(
      `INSERT INTO purchase_orders (merchant_company_id,supplier_company_id,status,total)
       VALUES ($1,$2,'enviado',$3) RETURNING id`,
      [petshop.companyId, fornecedor.companyId, total],
    )
  ).id;
const pedidoA = await novoPedido(310);
const pedidoB = await novoPedido(450);
const pedidoC = await novoPedido(120);

// Um orçamento com a proposta do fornecedor esperando o comerciante.
const orcamento = await uma(
  `INSERT INTO quote_requests (merchant_company_id,supplier_company_id,status)
   VALUES ($1,$2,'respondido') RETURNING id`,
  [petshop.companyId, fornecedor.companyId],
);
await db.query(
  `INSERT INTO quote_request_items (quote_request_id,item_name,base_unit,pack_size,quantity)
   VALUES ($1,'Areia sanitaria para gatos','kg',12,5)`,
  [orcamento.id],
);
const proposta = await uma(
  `INSERT INTO quote_proposals (quote_request_id,from_company_id,kind,total,status)
   VALUES ($1,$2,'proposta',290,'enviada') RETURNING id`,
  [orcamento.id, fornecedor.companyId],
);
await db.query(
  `INSERT INTO quote_proposal_items
     (proposal_id,item_name,base_unit,pack_size,quantity,unit_price,subtotal)
   VALUES ($1,'Areia sanitaria para gatos','kg',12,5,58,290)`,
  [proposta.id],
);
await db.close();

// --- servidor: sobe e para entre as fases, porque o PGlite é de um processo só ---
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

// --- endereço das funções: o arquivo mais novo do build (ver conversa.test.mjs) ---
const pastaAssets = path.resolve(".output/public/assets");
async function funcoesDe(prefixo) {
  let maisNovo = null;
  for (const nome of (await readdir(pastaAssets)).filter((n) =>
    new RegExp(`^${prefixo}\\.functions-.*\\.js$`).test(n),
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

const raizPnpm = path.resolve("node_modules/.pnpm");
const pastaSeroval = (await readdir(raizPnpm)).find((n) => /^seroval@/.test(n));
const { toJSONAsync } = await import(
  pathToFileURL(path.join(raizPnpm, pastaSeroval, "node_modules/seroval/dist/index.js")).href
);

async function chamar({ hash, metodo }, token, corpo) {
  const cabecalhos = {
    "x-tsr-serverFn": "true",
    Origin: `http://localhost:${PORTA}`,
    Referer: `http://localhost:${PORTA}/pedidos`,
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
const deuErro = (r) => r.status !== 200 || r.texto.includes("$TSR/Error");

/** Descobre, entre os POST, o que aceita este corpo — tentando de verdade. */
async function descobrir(funcoes, token, corpo) {
  for (const funcao of funcoes.filter((f) => f.metodo === "POST")) {
    if (!deuErro(await chamar(funcao, token, corpo))) return funcao;
  }
  return null;
}
const mostrarErro = () => {
  const linhas = saida.split("\n").filter((l) => /Error|error:/i.test(l));
  if (linhas.length) console.error("\nErro no servidor:\n  " + linhas.slice(0, 6).join("\n  "));
};

const funcoesDePedido = await funcoesDe("orders");
const funcoesDeOrcamento = await funcoesDe("quotes");

if (!(await subir())) {
  console.error("O servidor nao subiu.\n" + saida.slice(-600));
  encerrar(1);
}

// ======================================================================
console.log("--- orçamento fechado ---");
// O fornecedor tentar aceitar a própria proposta tem de falhar — e é também
// a prova de que a função certa foi achada, quando o comerciante conseguir.
const aceitaPropria = await descobrir(funcoesDeOrcamento, fornecedor.token, {
  quoteId: orcamento.id,
  proposalId: proposta.id,
});
ok(!aceitaPropria, "o fornecedor NÃO aceita a própria proposta");
const aceitar = await descobrir(funcoesDeOrcamento, petshop.token, {
  quoteId: orcamento.id,
  proposalId: proposta.id,
});
ok(Boolean(aceitar), "o comerciante aceita a proposta de R$ 290,00");
if (!aceitar) {
  mostrarErro();
  encerrar(1);
}

// ======================================================================
console.log("\n--- o fornecedor aceita os pedidos A, B e C ---");
const mudar = await descobrir(funcoesDePedido, fornecedor.token, {
  id: pedidoA,
  status: "aceito",
});
ok(Boolean(mudar), "o fornecedor aceita o A");
if (!mudar) {
  mostrarErro();
  encerrar(1);
}
ok(!deuErro(await chamar(mudar, fornecedor.token, { id: pedidoB, status: "aceito" })), "e o B");
ok(!deuErro(await chamar(mudar, fornecedor.token, { id: pedidoC, status: "aceito" })), "e o C");

console.log("\n--- o comerciante cancela o A ---");
ok(
  !deuErro(await chamar(mudar, petshop.token, { id: pedidoA, status: "cancelado" })),
  "o comerciante cancela o A, que já estava aceito",
);
ok(
  deuErro(await chamar(mudar, intruso.token, { id: pedidoC, status: "cancelado" })),
  "outra empresa NÃO consegue cancelar o C",
);
ok(
  deuErro(await chamar(mudar, fornecedor.token, { id: pedidoC, status: "cancelado" })),
  "o fornecedor não cancela (ele recusa, e só antes de aceitar)",
);

await parar();

// ======================================================================
console.log("\n--- conferência no banco ---");
db = await PGlite.create(BANCO);
const contas = async (pedido) =>
  (
    await db.query(
      "SELECT company_id, direction, amount::float amount, paid_at FROM finance_entries WHERE order_id=$1 ORDER BY direction",
      [pedido],
    )
  ).rows;

const doOrcamento = await uma(
  "SELECT id, status, total::float total FROM purchase_orders WHERE quote_proposal_id=$1",
  [proposta.id],
);
ok(Boolean(doOrcamento), "o orçamento fechado virou pedido");
ok(doOrcamento?.status === "aceito", `e o pedido nasce ACEITO (está "${doOrcamento?.status}")`);
const contasDoOrcamento = doOrcamento ? await contas(doOrcamento.id) : [];
ok(
  contasDoOrcamento.some(
    (c) => c.direction === "pagar" && c.company_id === petshop.companyId && c.amount === 290,
  ),
  "a conta a pagar de R$ 290,00 já está no financeiro do comerciante",
);
ok(
  contasDoOrcamento.some(
    (c) => c.direction === "receber" && c.company_id === fornecedor.companyId && c.amount === 290,
  ),
  "e a conta a receber de R$ 290,00 no do fornecedor",
);

ok((await contas(pedidoA)).length === 0, "A cancelado: as duas contas saíram");
ok(
  (await uma("SELECT status FROM purchase_orders WHERE id=$1", [pedidoA])).status === "cancelado",
  "e o A está cancelado",
);
ok((await contas(pedidoC)).length === 2, "C não foi mexido: continua com as duas contas");
ok((await contas(pedidoB)).length === 2, "B aceito tem as duas contas");

// O comerciante registra que já pagou B.
await db.query(
  `UPDATE finance_entries SET paid_at=now(), paid_amount=amount
    WHERE order_id=$1 AND company_id=$2`,
  [pedidoB, petshop.companyId],
);
await db.close();

// ======================================================================
console.log("\n--- o comerciante cancela o B, que já tinha pagado ---");
ok(await subir(), "o servidor volta a subir");
ok(
  !deuErro(await chamar(mudar, petshop.token, { id: pedidoB, status: "cancelado" })),
  "o cancelamento é aceito",
);
await parar();

db = await PGlite.create(BANCO);
const contasB = await contas(pedidoB);
ok(
  contasB.some((c) => c.direction === "pagar" && c.paid_at !== null),
  "a conta PAGA do comerciante continua lá — é o registro do dinheiro que saiu",
);
ok(
  contasB.some((c) => c.direction === "receber"),
  "e a do fornecedor também — é o valor que ele tem de devolver",
);
await db.close();

await rm(PASTA, { recursive: true, force: true });
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
