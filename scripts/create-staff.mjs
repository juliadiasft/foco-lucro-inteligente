// Cria ou atualiza uma conta do back office.
//
// Uso:
//   node scripts/create-staff.mjs "email@dominio.com" "Nome" "senha" [admin|financeiro|suporte]
//
// Nao existe conta padrao no sistema e nenhuma senha fica em variavel de
// ambiente: a primeira conta e criada de proposito, por quem administra a
// plataforma.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import process from "node:process";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Client } = pg;

const [email, name, password, role = "admin"] = process.argv.slice(2);

if (!email || !name || !password) {
  console.error('Uso: node scripts/create-staff.mjs "email" "Nome" "senha" [papel]');
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
