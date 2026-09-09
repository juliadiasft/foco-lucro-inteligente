// Cria ou atualiza uma conta do back office.
//
// Uso:
//   node scripts/create-staff.mjs "email@dominio.com" "Nome" [admin|financeiro|suporte]
//
// A senha e pedida na hora, sem aparecer na tela. Passar senha como argumento
// deixa ela no historico do terminal, de onde nao sai mais — e o historico e
// exatamente o primeiro lugar que alguem com acesso a maquina olha.
//
// Nao existe conta padrao no sistema e nenhuma senha fica em variavel de
// ambiente: a primeira conta e criada de proposito, por quem administra a
// plataforma.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createInterface } from "node:readline";
import process from "node:process";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Client } = pg;

const [email, name, role = "admin"] = process.argv.slice(2);

if (!email || !name) {
  console.error('Uso: node scripts/create-staff.mjs "email" "Nome" [papel]');
  process.exit(1);
}

/** Le uma senha do teclado sem ecoar o que foi digitado. */
function pedirSenha(rotulo) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Rode este comando num terminal, para poder digitar a senha."));
      return;
    }
    const leitor = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // O readline escreve cada tecla na tela; trocamos a escrita por nada
    // enquanto a pergunta esta ativa, para a senha nao aparecer.
    let escondendo = false;
    const escreverOriginal = leitor._writeToOutput?.bind(leitor);
    leitor._writeToOutput = (texto) => {
      if (!escondendo) escreverOriginal?.(texto);
    };
    leitor.question(`${rotulo}: `, (valor) => {
      leitor.close();
      process.stdout.write("\n");
      resolve(valor);
    });
    escondendo = true;
  });
}

let password;
let confirmacao;
try {
  password = await pedirSenha("Senha do back office (nao aparece na tela)");
  confirmacao = await pedirSenha("Digite de novo para confirmar");
} catch (erro) {
  // Sem terminal nao da para digitar em segredo. Melhor recusar com uma frase
  // legivel do que despejar um rastro de pilha em cima de quem so queria criar
  // uma conta.
  console.error(erro.message);
  process.exit(1);
}

if (password !== confirmacao) {
  console.error("As duas senhas nao batem. Nada foi alterado.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("A senha do back office precisa ter no minimo 12 caracteres.");
  process.exit(1);
}
if (!["admin", "financeiro", "suporte"].includes(role)) {
  console.error("Papel invalido. Use admin, financeiro ou suporte.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL nao configurada");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;

const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
try {
  await client.query(
    `INSERT INTO staff_users (name,email,password_hash,role)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE
       SET name=excluded.name, password_hash=excluded.password_hash,
           role=excluded.role, active=true, updated_at=now()`,
    [name, email.toLowerCase(), passwordHash, role],
  );
  console.log(`Conta de back office pronta: ${email.toLowerCase()} (${role})`);
} finally {
  await client.end();
}
