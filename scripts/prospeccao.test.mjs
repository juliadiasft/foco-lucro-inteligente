// Testa a prospecção dentro do back office.
//
//   node scripts/prospeccao.test.mjs
//
// Duas coisas podem dar errado aqui, e as duas são caras.
//
// A primeira é vazamento: a tabela guarda telefone e e-mail de 148 mil
// empresas que NÃO são clientes da Central. Se um comerciante logado
// conseguir ler isso, virou lista vendida sem querer.
//
// A segunda é perda de trabalho: a importação roda de novo toda vez que a
// lista é refeita, e o que a Julia anotou depois de uma ligação — status,
// com quem falou, de quem o pet shop compra — não pode ser sobrescrito pelos
// dados da Receita.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const db = new PGlite();
const dir = path.resolve("migrations");
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
}
const uma = async (sql, p = []) => (await db.query(sql, p)).rows[0];

console.log("--- a tabela guarda o que a tela precisa ---");
const colunas = await db.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='prospects'`,
);
const nomes = new Set(colunas.rows.map((c) => c.column_name));
for (const precisa of [
  "cnpj", "razao_social", "lado", "nicho", "cidade", "uf", "telefone", "whatsapp",
  "email", "situacao", "confere", "matriz_ou_filial", "contatos_iguais",
  "status", "responsavel_id", "compra_de_quem", "company_id",
]) {
  ok(nomes.has(precisa), `coluna ${precisa}`);
}

console.log("\n--- o lado e o status não aceitam valor inventado ---");
// Um lado errado colocaria fornecedor na lista de quem compra, e a mensagem
// enviada seria a errada — o pior tipo de erro numa abordagem fria.
let recusou = false;
try {
  await db.exec(`INSERT INTO prospects (cnpj,lado) VALUES ('11111111000111','qualquer')`);
} catch {
  recusou = true;
}
ok(recusou, "lado fora de comerciante/fornecedor é barrado pelo banco");

await db.exec(
  `INSERT INTO prospects (cnpj,razao_social,lado,uf,cidade,telefone,whatsapp,situacao,confere)
   VALUES ('22222222000122','DISTRIBUIDORA TESTE LTDA','fornecedor','SP','CAMPINAS','(19) 99999-8888','19999998888','Ativa','principal')`,
);
recusou = false;
try {
  await db.query(`UPDATE prospects SET status='inventado' WHERE cnpj='22222222000122'`);
} catch {
  recusou = true;
}
ok(recusou, "status fora das seis etapas é barrado");

console.log("\n--- nasce como 'a contatar', que é o padrão seguro ---");
const nova = await uma(`SELECT status, nicho FROM prospects WHERE cnpj='22222222000122'`);
ok(nova.status === "a contatar", `empresa nova nasce em "${nova.status}"`);
ok(nova.nicho === "pet", "e no nicho pet, que é o único hoje");

console.log("\n--- o CNPJ é único: reimportar não duplica ---");
let duplicou = false;
try {
  await db.exec(`INSERT INTO prospects (cnpj,lado) VALUES ('22222222000122','fornecedor')`);
  duplicou = true;
} catch {
  /* esperado */
}
ok(!duplicou, "o mesmo CNPJ duas vezes é recusado");

console.log("\n--- REIMPORTAR NÃO APAGA O TRABALHO ---");
// É o teste que mais importa. A Julia liga, anota, e depois alguém roda a
// importação de novo porque a lista foi refeita. O que ela escreveu tem que
// continuar lá.
await db.query(
  `UPDATE prospects SET status='respondeu', quem_falou='Marcos', compra_de_quem='Purina e Golden',
          observacoes='Pediu para ligar depois das 14h', contatado_em=now()
    WHERE cnpj='22222222000122'`,
);

// Exatamente o UPDATE que a importação faz: só as colunas da Receita.
await db.query(
  `INSERT INTO prospects (cnpj,razao_social,nome_fantasia,lado,nicho,cidade,uf,telefone,
                          telefone2,email,whatsapp,situacao,ramo_principal,fornece,confere,
                          matriz_ou_filial,enderecos_da_empresa,contatos_iguais,nome_sugere_pet)
   VALUES ('22222222000122','DISTRIBUIDORA TESTE LTDA - NOME NOVO','','fornecedor','pet',
           'CAMPINAS','SP','(19) 99999-7777','','novo@teste.com','19999997777','Ativa',
           'Comercio atacadista','racao','principal','unica',1,1,true)
   ON CONFLICT (cnpj) DO UPDATE SET
     razao_social = EXCLUDED.razao_social,
     telefone = EXCLUDED.telefone,
     email = EXCLUDED.email,
     whatsapp = EXCLUDED.whatsapp,
     atualizado_em = now()`,
);

const depois = await uma(
  `SELECT razao_social, telefone, email, status, quem_falou, compra_de_quem, observacoes, contatado_em
     FROM prospects WHERE cnpj='22222222000122'`,
);
ok(depois.razao_social.includes("NOME NOVO"), "o dado da Receita foi atualizado");
ok(depois.telefone === "(19) 99999-7777", "o telefone novo entrou");
ok(depois.status === "respondeu", "o status que a Julia marcou CONTINUA lá");
ok(depois.quem_falou === "Marcos", "com quem ela falou continua lá");
ok(depois.compra_de_quem === "Purina e Golden", "de quem o pet shop compra continua lá");
ok(depois.observacoes.includes("14h"), "a observação continua lá");
ok(depois.contatado_em !== null, "a data do contato continua lá");

console.log("\n--- o responsável some junto com quem saiu do time ---");
// ON DELETE SET NULL: se alguém sai da equipe, a empresa volta para a fila em
// vez de sumir do sistema apontando para uma pessoa que não existe mais.
const staff = await uma(
  `INSERT INTO staff_users (email,name,password_hash,role) VALUES ('vendedor@teste','Vendedor','x','suporte') RETURNING id`,
);
await db.query(`UPDATE prospects SET responsavel_id=$1 WHERE cnpj='22222222000122'`, [staff.id]);
await db.query(`DELETE FROM staff_users WHERE id=$1`, [staff.id]);
const orfa = await uma(`SELECT responsavel_id, status FROM prospects WHERE cnpj='22222222000122'`);
ok(orfa.responsavel_id === null, "o responsável fica nulo");
ok(orfa.status === "respondeu", "e a empresa continua na lista, com o trabalho preservado");

console.log("\n--- a lista some se a empresa virar cliente e o cliente for apagado ---");
const empresa = await uma(
  `INSERT INTO companies (name,account_type,plan) VALUES ('Virou Cliente','fornecedor','essencial') RETURNING id`,
);
await db.query(`UPDATE prospects SET company_id=$1 WHERE cnpj='22222222000122'`, [empresa.id]);
await db.query(`DELETE FROM companies WHERE id=$1`, [empresa.id]);
const semCliente = await uma(`SELECT company_id FROM prospects WHERE cnpj='22222222000122'`);
ok(semCliente.company_id === null, "apagar o cliente não apaga a empresa da prospecção");

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
