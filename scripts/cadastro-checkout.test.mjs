// O caminho inteiro de um cliente novo: cadastro com CNPJ até o checkout.
//
//   node scripts/cadastro-checkout.test.mjs
//
// Os testes que já existiam cobriam as pontas: o mapa de CNAE e a BrasilAPI
// (cnpj-cadastro.test.mjs) de um lado, o webhook da Cakto virando acesso
// (pagamento.test.mjs) do outro. O meio estava sem ninguém: a pessoa digitando
// o CNPJ, a conta nascendo, e o link de pagamento saindo amarrado a ela.
//
// É esse meio que os fornecedores da lista vão percorrer nos próximos dias.
//
// O teste usa CNPJ de empresa real, tirado da lista da Receita, porque CNPJ
// inventado passa na validação de dígito e some na consulta — e a consulta é
// justamente o que precisa ser testado. Os documentos não são impressos
// inteiros em lugar nenhum: aqui e no sistema, só os quatro últimos dígitos.
//
// O que ele NÃO faz: pagar. Nenhum teste deve mover dinheiro de verdade. Ele
// vai até o link de checkout e confere que o link leva à oferta certa e carrega
// a marca que liga o pagamento a esta empresa. O que acontece depois do
// pagamento é o pagamento.test.mjs que cobre.
//
// O teste roda em duas fases, e a ordem não é estilo: é obrigatória. Primeiro
// tudo que fala com o servidor pela rede; depois, com o servidor JÁ PARADO, a
// conferência do que ficou gravado. O banco local é de um processo só — abrir
// ele por fora enquanto o servidor está de pé corrompe o arquivo, e isso já
// aconteceu duas vezes aqui.
import { readFile, readdir, rm } from "node:fs/promises";
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

const PASTA = pastaPropria("cadastro-test");
const PORTA = await portaLivre();

// Empresas de verdade, ativas na Receita, tiradas da nossa lista de pet shop.
// São pessoas jurídicas de propósito: um MEI traz o nome de uma pessoa junto,
// e nome de gente não entra num arquivo de teste. Só o final do número aparece
// nas mensagens.
const FORNECEDOR_CNPJ = "40051364000115"; // ALDEIA PET LTDA, Aguaí/SP
const COMERCIANTE_CNPJ = "59749272000131"; // CIA DOS ANIMAIS LTDA, Adamantina/SP
const fim = (cnpj) => `final ${cnpj.slice(-4)}`;

const EMAIL_FORNECEDOR = "fornecedor.teste@central.local";
const EMAIL_COMERCIANTE = "comerciante.teste@central.local";

// Ofertas de mentira. Elas precisam morar em cakto.com.br porque o sistema
// recusa qualquer outro domínio — e essa recusa é uma proteção que vale ouro:
// sem ela, quem mexesse numa variável de ambiente poderia mandar os clientes
// pagarem num site de fachada. Por isso o endereço aqui é um subdomínio que
// não existe: passa na trava, e o teste monta o link sem nunca abrir.
const CHECKOUT = "https://checkout-de-teste.cakto.com.br";
const OFERTAS = {
  CAKTO_CHECKOUT_ESSENCIAL: `${CHECKOUT}/ofertaessencial`,
  CAKTO_CHECKOUT_PROFISSIONAL: `${CHECKOUT}/ofertaprofissional`,
  CAKTO_CHECKOUT_PREMIUM: `${CHECKOUT}/ofertapremium`,
  CAKTO_CHECKOUT_ESSENCIAL_ANUAL: `${CHECKOUT}/ofertaessencialano`,
  CAKTO_CHECKOUT_PROFISSIONAL_ANUAL: `${CHECKOUT}/ofertaprofissionalano`,
  CAKTO_CHECKOUT_PREMIUM_ANUAL: `${CHECKOUT}/ofertapremiumano`,
};

// --- banco descartável, do jeito que o servidor espera encontrar ---
// A pasta precisa se chamar central-comerciante, e as migrações precisam ficar
// anotadas em app_migrations: sem isso o servidor roda tudo de novo e morre em
// "constraint already exists", derrubando as telas por culpa do teste.
const preparo = await PGlite.create(path.resolve(PASTA, "central-comerciante"));
await preparo.exec(
  `CREATE TABLE IF NOT EXISTS app_migrations (
     name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
);
const dirMigracoes = path.resolve("migrations");
for (const arquivo of (await readdir(dirMigracoes)).filter((n) => n.endsWith(".sql")).sort()) {
  await preparo.exec(await readFile(path.join(dirMigracoes, arquivo), "utf8"));
  await preparo.query("INSERT INTO app_migrations (name) VALUES ($1)", [arquivo]);
}

// As duas empresas entram na lista de prospecção antes de se cadastrarem, que
// é a situação real: elas estão lá desde a importação da Receita, alguém já
// mandou mensagem, e um dia elas aparecem no cadastro.
for (const [cnpj, lado, nome] of [
  [FORNECEDOR_CNPJ, "fornecedor", "ALDEIA PET LTDA"],
  [COMERCIANTE_CNPJ, "comerciante", "CIA DOS ANIMAIS LTDA"],
]) {
  await preparo.query(
    `INSERT INTO prospects (cnpj,razao_social,lado,uf,cidade,situacao,status,quem_falou)
     VALUES ($1,$2,$3,'SP','TESTE','Ativa','contatado','Julia')`,
    [cnpj, nome, lado],
  );
}
await preparo.close();

// O segredo que embaralha o CPF/CNPJ antes de gravar. Sem ele o sistema RECUSA
// cadastrar — de propósito: um hash sem segredo é adivinhável, e aí a tabela de
// documentos vira uma lista de CNPJs consultável por quem tiver o banco. Este
// aqui é de mentira, e serve só para o teste; o de verdade mora nas variáveis
// de ambiente do servidor e não passa por aqui.
const SEGREDO_DOCUMENTO = "segredo-de-teste-local-nao-e-o-de-producao";
// O segredo depois de uma troca, para testar que trocar não apaga as travas.
const SEGREDO_NOVO = "segredo-de-teste-local-depois-da-troca-1";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let saida = "";
let servidor = null;

/** Sobe o servidor e espera ele atender. Devolve false se não subir. */
async function subirServidor(variaveis = {}) {
  servidor = spawn(process.execPath, [".output/server/index.mjs"], {
    env: {
      ...process.env,
      PORT: String(PORTA),
      LOCAL_DB_DIR: PASTA,
      DATABASE_URL: "",
      DOCUMENT_HASH_SECRET: SEGREDO_DOCUMENTO,
      ...OFERTAS,
      ...variaveis,
    },
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
      /* ainda subindo */
    }
    await dormir(1500);
  }
  return false;
}

/**
 * Para o servidor e espera ele sair de verdade.
 *
 * A espera não é frescura: o banco local é de um processo só, e seguir adiante
 * enquanto o processo antigo ainda o segura dá erro de arquivo em uso — ou,
 * pior, escrita pela metade.
 */
async function pararServidor() {
  if (!servidor) return;
  const morto = new Promise((resolve) => servidor.once("exit", resolve));
  servidor.kill();
  await Promise.race([morto, dormir(5000)]);
  servidor = null;
  await dormir(500);
}

const encerrar = (codigo) => {
  if (servidor) servidor.kill();
  process.exit(codigo);
};
const erroDoServidor = () =>
  saida
    .split("\n")
    .filter((l) => /Error|error:/i.test(l))
    .slice(0, 6);

const noAr = await subirServidor();
if (!noAr) {
  console.error("O servidor nao subiu.\n" + saida.slice(-600));
  encerrar(1);
}

// --- como falar com uma função do servidor ---
// O corpo vai em Seroval, não em JSON puro; sem x-tsr-serverFn a chamada não é
// tratada como função; sem Origin do mesmo endereço a proteção de CSRF
// responde 403. As três juntas, e não uma de cada vez.
const raizPnpm = path.resolve("node_modules/.pnpm");
const pastaSeroval = (await readdir(raizPnpm)).find((n) => /^seroval@/.test(n));
if (!pastaSeroval) {
  console.error("Nao achei o seroval em node_modules — sem ele nao da para montar o corpo.");
  encerrar(1);
}
const { toJSONAsync } = await import(
  pathToFileURL(path.join(raizPnpm, pastaSeroval, "node_modules/seroval/dist/index.js")).href
);

let cookieAtual = "";
async function chamar(
  { hash, metodo },
  corpo,
  { cookie = cookieAtual, guardarCookie = false } = {},
) {
  const cabecalhos = {
    "x-tsr-serverFn": "true",
    Origin: `http://localhost:${PORTA}`,
    Referer: `http://localhost:${PORTA}/cadastro`,
  };
  if (cookie) cabecalhos.Cookie = cookie;
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
  const texto = await r.text();
  if (guardarCookie) {
    const sessao = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("central_session="));
    if (sessao) cookieAtual = sessao.split(";")[0];
  }
  return { status: r.status, texto };
}
const deuErro = (r) => r.status !== 200 || r.texto.includes("$TSR/Error");
// A mensagem de erro vem escapada dentro do Seroval; desfazer as barras basta
// para conferir o texto.
const mensagem = (r) => r.texto.replace(/\\+/g, "");

// --- descobre o endereço de cada função ---
//
// O build parte cada tela em vários arquivos com o mesmo começo de nome —
// `index-` sozinho são treze. Como a pasta do build é limpa a cada `pnpm
// build`, todos que estão lá são da mesma versão e dá para juntar os endereços
// de todos. Antes dessa limpeza isso não valia: conviviam seis versões da
// mesma tela, e juntar tudo devolvia endereço de código fora do ar.
const pastaAssets = path.resolve(".output/public/assets");
const todos = await readdir(pastaAssets);
async function funcoesDe(prefixo) {
  const encontradas = new Map();
  for (const nome of todos.filter((n) => n.startsWith(prefixo) && n.endsWith(".js"))) {
    const texto = await readFile(path.join(pastaAssets, nome), "utf8");
    for (const m of texto.matchAll(/method:"(GET|POST)"[^"]*"([a-f0-9]{64})"/g)) {
      if (!encontradas.has(m[2])) encontradas.set(m[2], { metodo: m[1], hash: m[2] });
    }
  }
  return [...encontradas.values()];
}

const doIndex = await funcoesDe("index-");
const doCadastro = await funcoesDe("cadastro-");
const doBilling = await funcoesDe("billing.functions-");
if (!doIndex.length || !doCadastro.length || !doBilling.length) {
  console.error("Nao achei os pedacos do build. Rode `pnpm build` antes do teste.");
  encerrar(1);
}

// Qual endereço é o cadastro se descobre mandando um formulário VAZIO e vendo
// quem reclama dos campos do cadastro. Descobrir assim, e não mandando um
// cadastro bom em cada endereço, evita o erro que este teste cometeu antes:
// uma função vizinha que aceita qualquer coisa e responde "ok" foi tomada pelo
// cadastro, e as conferências seguintes falharam todas sem explicar por quê.
let cadastrar = null;
for (const funcao of doIndex.filter((f) => f.metodo === "POST")) {
  const r = await chamar(funcao, {}, { cookie: "" });
  if (deuErro(r) && /acceptedTerms|"company"/.test(mensagem(r))) {
    cadastrar = funcao;
    break;
  }
}
if (!cadastrar) {
  console.error("Nao encontrei a funcao de cadastro no build.");
  encerrar(1);
}

console.log("--- a Receita responde e o cadastro se preenche sozinho ---");
// Quem digita o CNPJ não deveria ter que digitar mais nada. Se esta consulta
// parar de funcionar, o cadastro não quebra — vira um formulário em branco, e
// aí a pessoa desiste no meio.
let consulta = null;
for (const funcao of doCadastro.filter((f) => f.metodo === "POST")) {
  const r = await chamar(funcao, { cnpj: FORNECEDOR_CNPJ }, { cookie: "" });
  if (!deuErro(r) && /raz|nome|cnae/i.test(r.texto)) {
    consulta = r;
    break;
  }
}
ok(Boolean(consulta), `a consulta do CNPJ ${fim(FORNECEDOR_CNPJ)} responde`);
if (consulta) {
  ok(/ALDEIA PET/i.test(consulta.texto), "traz a razão social da empresa certa");
  ok(/"SP"/.test(consulta.texto), "traz o estado");
  ok(/pet/i.test(consulta.texto), "e sugere o nicho pet a partir do CNAE");
} else {
  console.log("      (a BrasilAPI pode estar fora do ar — o cadastro segue funcionando sem ela)");
}

console.log("\n--- o fornecedor se cadastra ---");
const cadastroFornecedor = {
  name: "Responsavel Teste",
  company: "Aldeia Pet",
  accountType: "fornecedor",
  segments: ["pet"],
  city: "Aguai",
  uf: "SP",
  phone: "19999998888",
  document: FORNECEDOR_CNPJ,
  email: EMAIL_FORNECEDOR,
  password: "senha-de-teste-local-1",
  acceptedTerms: true,
};
const novoFornecedor = await chamar(cadastrar, cadastroFornecedor, {
  cookie: "",
  guardarCookie: true,
});
ok(!deuErro(novoFornecedor), "o cadastro do fornecedor é aceito");
ok(Boolean(cookieAtual), "e a pessoa já entra logada, sem precisar fazer login");
if (deuErro(novoFornecedor)) {
  console.error("      " + mensagem(novoFornecedor).slice(0, 300));
  const linhas = erroDoServidor();
  if (linhas.length) console.error("\nErro no servidor:\n  " + linhas.join("\n  "));
  encerrar(1);
}

console.log("\n--- o teste grátis não se repete ---");
// Sem isto, a mesma empresa reabre conta toda semana e nunca paga.
const segundaVez = await chamar(
  cadastrar,
  { ...cadastroFornecedor, email: "outro.email@central.local" },
  { cookie: "" },
);
ok(deuErro(segundaVez), "o mesmo CNPJ não abre uma segunda conta");
ok(
  /utilizou o teste|teste gr.?tis/i.test(mensagem(segundaVez)),
  "e a mensagem explica o motivo, em vez de dar erro genérico",
);

const emailRepetido = await chamar(
  cadastrar,
  { ...cadastroFornecedor, document: COMERCIANTE_CNPJ },
  { cookie: "" },
);
ok(deuErro(emailRepetido), "o mesmo e-mail não abre duas contas");

const documentoFalso = await chamar(
  cadastrar,
  { ...cadastroFornecedor, document: "11111111111111", email: "falso@central.local" },
  { cookie: "" },
);
ok(deuErro(documentoFalso), "CNPJ com dígito inválido é recusado");

console.log("\n--- o comerciante se cadastra ---");
const novoComerciante = await chamar(
  cadastrar,
  {
    ...cadastroFornecedor,
    accountType: "comerciante",
    company: "Pet Shop Teste",
    city: "Adamantina",
    document: COMERCIANTE_CNPJ,
    email: EMAIL_COMERCIANTE,
  },
  { cookie: "", guardarCookie: true },
);
ok(!deuErro(novoComerciante), `o cadastro do comerciante ${fim(COMERCIANTE_CNPJ)} é aceito`);

console.log("\n--- e o caminho até o pagamento ---");
// O comerciante recém-cadastrado continua logado no cookieAtual.
let checkout = null;
let linkGerado = null;
for (const funcao of doBilling.filter((f) => f.metodo === "POST")) {
  const r = await chamar(funcao, { plan: "profissional", cycle: "mensal" });
  if (!deuErro(r) && r.texto.includes("checkout-de-teste.cakto.com.br")) {
    checkout = funcao;
    linkGerado = r;
    break;
  }
}
ok(Boolean(checkout), "o botão de assinar gera o link de pagamento");
if (!checkout) {
  console.error("\nO que cada função de cobrança respondeu:");
  for (const funcao of doBilling.filter((f) => f.metodo === "POST")) {
    const r = await chamar(funcao, { plan: "profissional", cycle: "mensal" });
    console.error(`  ${funcao.hash.slice(0, 10)}  HTTP ${r.status}  ${mensagem(r).slice(0, 240)}`);
  }
  const linhas = erroDoServidor();
  if (linhas.length) console.error("\nErro no servidor:\n  " + linhas.join("\n  "));
  encerrar(1);
}

// O link vem dentro do texto serializado, com as barras escapadas.
const cru = linkGerado.texto.match(/https:\\?\/\\?\/[a-z0-9.-]*cakto\.com\.br[^"]+/i)?.[0] ?? "";
const url = new URL(cru.replace(/\\/g, ""));
ok(
  url.pathname.includes("ofertaprofissional"),
  `o link leva à oferta do plano escolhido (${url.pathname})`,
);
ok(url.searchParams.get("email") === EMAIL_COMERCIANTE, "com o e-mail já preenchido");
ok(Boolean(url.searchParams.get("name")), "e o nome já preenchido");
ok(
  Boolean(url.searchParams.get("utm_content")),
  "o link carrega a marca que liga este pagamento a esta empresa",
);

const anual = await chamar(checkout, { plan: "premium", cycle: "anual" });
ok(!deuErro(anual), "o plano anual também gera link");
ok(anual.texto.includes("ofertapremiumano"), "e vai para a oferta anual, e não a mensal");

const semLogin = await chamar(checkout, { plan: "profissional", cycle: "mensal" }, { cookie: "" });
ok(deuErro(semLogin), "sem estar logado, não sai link de pagamento");

console.log("\n--- trocar o segredo não devolve o teste grátis a ninguém ---");
// Um segredo exposto tem que ser trocado no mesmo dia. Se trocar apagasse a
// memória das travas, todo mundo que já se cadastrou ganharia um segundo teste
// grátis — e ninguém perceberia até a receita não aparecer. É o tipo de custo
// escondido que faz a troca ser adiada, e adiar é como um segredo exposto vira
// permanente.
await pararServidor();
const subiuComSegredoNovo = await subirServidor({
  DOCUMENT_HASH_SECRET: SEGREDO_NOVO,
  DOCUMENT_HASH_SECRET_ANTERIOR: SEGREDO_DOCUMENTO,
});
ok(subiuComSegredoNovo, "o sistema sobe com o segredo trocado");
if (subiuComSegredoNovo) {
  const depoisDaTroca = await chamar(
    cadastrar,
    { ...cadastroFornecedor, email: "depois.da.troca@central.local" },
    { cookie: "" },
  );
  ok(deuErro(depoisDaTroca), "e o CNPJ que já se cadastrou continua barrado");
  ok(
    /utilizou o teste|teste gr.?tis/i.test(mensagem(depoisDaTroca)),
    "pelo mesmo motivo de antes, e não por acidente",
  );

  // E o contrário: sem declarar o segredo anterior, a trava esquece. Este é o
  // erro que a mudança evita, e testá-lo é o que prova que ela faz algo.
  await pararServidor();
  await subirServidor({ DOCUMENT_HASH_SECRET: SEGREDO_NOVO });
  const semOAnterior = await chamar(
    cadastrar,
    { ...cadastroFornecedor, email: "sem.o.anterior@central.local" },
    { cookie: "" },
  );
  ok(
    !deuErro(semOAnterior),
    "e sem declarar o segredo antigo a trava realmente esquece (é o que se evita)",
  );
}

// --- fim das chamadas: o servidor sai de cena antes de o banco ser aberto ---
await pararServidor();

const conferencia = await PGlite.create(path.resolve(PASTA, "central-comerciante"));
const uma = async (sql, p = []) => (await conferencia.query(sql, p)).rows[0];

console.log("\n--- o que ficou gravado ---");
const empresa = await uma(
  `SELECT c.id, c.name, c.account_type, c.uf, c.supplier_verification
     FROM companies c JOIN users u ON u.company_id=c.id WHERE lower(u.email)=$1`,
  [EMAIL_FORNECEDOR],
);
ok(Boolean(empresa), "a empresa do fornecedor existe no banco");
ok(
  empresa?.account_type === "fornecedor",
  `entrou como fornecedor (veio '${empresa?.account_type}')`,
);
ok(empresa?.uf === "SP", "com o estado que veio da Receita");
ok(
  ["aprovado", "em_analise"].includes(empresa?.supplier_verification),
  `a verificação decidiu algo em vez de ficar em branco (${empresa?.supplier_verification})`,
);

console.log("\n--- e o CNPJ NÃO fica guardado inteiro ---");
// Regra da casa: documento completo não entra no banco. Fica um hash e os
// quatro últimos dígitos, que é o suficiente para a pessoa se reconhecer.
const reivindicacao = await uma(
  `SELECT document_hash, document_type, document_last4
     FROM trial_identity_claims WHERE company_id=$1`,
  [empresa?.id],
);
ok(Boolean(reivindicacao), "o teste grátis foi reivindicado por este documento");
ok(reivindicacao?.document_type === "cnpj", "reconhecido como CNPJ");
ok(reivindicacao?.document_last4 === FORNECEDOR_CNPJ.slice(-4), "guardou os quatro últimos");
ok(
  !String(reivindicacao?.document_hash ?? "").includes(FORNECEDOR_CNPJ),
  "e o hash não contém o número",
);

// Varre TODA coluna de texto do banco atrás do CNPJ inteiro. É a única forma
// de saber que ele não vazou para um campo que ninguém lembrava que existia.
//
// Uma exceção, e só uma: prospects.cnpj. Ali o número não veio do cadastro de
// ninguém — veio dos Dados Abertos da Receita, que publicam o CNPJ de toda
// empresa do país. A regra que este teste defende é sobre o documento que o
// cliente entrega ao se cadastrar, e esse continua virando hash.
//
// A exceção é escrita com nome e sobrenome de propósito. Se fosse "ignore a
// tabela prospects", uma coluna nova guardando documento passaria despercebida
// — e uma exceção larga demais é exatamente como uma regra dessas morre.
const PERMITIDO = new Set(["prospects.cnpj"]);
const colunas = await conferencia.query(
  `SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public' AND data_type IN ('text','character varying')`,
);
const vazamentos = [];
for (const { table_name, column_name } of colunas.rows) {
  if (PERMITIDO.has(`${table_name}.${column_name}`)) continue;
  const achou = await conferencia.query(
    `SELECT 1 FROM "${table_name}" WHERE "${column_name}" LIKE $1 LIMIT 1`,
    [`%${FORNECEDOR_CNPJ}%`],
  );
  if (achou.rows.length) vazamentos.push(`${table_name}.${column_name}`);
}
ok(
  vazamentos.length === 0,
  `o número inteiro não está em nenhuma das ${colunas.rows.length - PERMITIDO.size} colunas` +
    (vazamentos.length ? ` — achado em ${vazamentos.join(", ")}` : ""),
);

console.log("\n--- a conta do comerciante nasceu certa ---");
const nichos = await conferencia.query(
  `SELECT cs.segment_id FROM company_segments cs
     JOIN companies c ON c.id=cs.company_id
     JOIN users u ON u.company_id=c.id WHERE lower(u.email)=$1`,
  [EMAIL_COMERCIANTE],
);
ok(
  nichos.rows.some((l) => l.segment_id === "pet"),
  `o nicho pet foi gravado (veio: ${nichos.rows.map((l) => l.segment_id).join(", ") || "nenhum"})`,
);
const assinatura = await uma(
  `SELECT s.plan, s.status FROM subscriptions s
     JOIN users u ON u.company_id=s.company_id WHERE lower(u.email)=$1`,
  [EMAIL_COMERCIANTE],
);
ok(
  assinatura?.status === "trialing",
  `a conta nasce em teste grátis (veio '${assinatura?.status}')`,
);

console.log("\n--- quem estava na lista de prospecção vira cliente sozinho ---");
// Sem isto, a pessoa que prospecta liga para quem já assinou — o pior tipo de
// ligação, porque queima a confiança de quem acabou de pagar.
for (const [cnpj, quem, email] of [
  [FORNECEDOR_CNPJ, "o fornecedor", EMAIL_FORNECEDOR],
  [COMERCIANTE_CNPJ, "o comerciante", EMAIL_COMERCIANTE],
]) {
  const linha = await uma(
    `SELECT p.status, p.quem_falou, p.company_id, u.email
       FROM prospects p LEFT JOIN users u ON u.company_id = p.company_id
      WHERE p.cnpj = $1`,
    [cnpj],
  );
  ok(linha?.status === "cadastrou", `${quem} saiu de "contatado" para "${linha?.status}"`);
  ok(linha?.email === email, `e a linha aponta para a conta que ele abriu`);
  // O trabalho de quem ligou continua lá: virar cliente não apaga a anotação.
  ok(linha?.quem_falou === "Julia", "sem apagar com quem já se tinha falado");
}

console.log("\n--- e o pagamento sabe de quem é ---");
// Este é o elo que, se quebrar, faz o dinheiro entrar sem o cliente receber
// acesso: o pagamento volta da Cakto com a marca do link, e o sistema precisa
// saber a quem devolver o acesso.
const intencao = await uma(
  `SELECT ci.plan, ci.billing_cycle, ci.used_at, u.email
     FROM checkout_intents ci JOIN users u ON u.id=ci.user_id
    ORDER BY ci.expires_at DESC`,
);
ok(Boolean(intencao), "a intenção de compra ficou registrada");
ok(intencao?.email === EMAIL_COMERCIANTE, "apontando para quem clicou");
ok(intencao?.used_at === null, "e ainda não usada, porque ninguém pagou de verdade");

await conferencia.close();
await rm(PASTA, { recursive: true, force: true });
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
