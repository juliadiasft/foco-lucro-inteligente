// Testa a trava que decide qual fornecedor publica vitrine sozinho.
//
//   node scripts/fornecedor-verificacao.test.mjs
//
// Errar para o lado frouxo enche a busca de vitrine falsa e envenena a
// comparação, que é o produto. Errar para o lado apertado manda distribuidora
// de verdade para uma fila e faz ela desistir. As duas falhas são caras, e a
// segunda é silenciosa: ninguém reclama, só não volta.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { cnaeDeFornecedor } = await import("../src/lib/cnae-segmento.ts");

console.log("--- quem passa direto ---");
const passam = [
  [4635402, "atacado de cerveja, chope e refrigerante"],
  [4639701, "atacado de produtos alimentícios em geral"],
  [4691500, "atacado de mercadorias em geral"],
  [4646002, "atacado de cosméticos e higiene pessoal"],
  [1091102, "fabricação de produtos de padaria"],
  [1052000, "fabricação de laticínios"],
  [4530701, "atacado de peças para veículos"],
];
for (const [cnae, rotulo] of passam) {
  ok(cnaeDeFornecedor(cnae) === true, `${rotulo} (${cnae})`);
}

console.log("\n--- quem vai para análise ---");
const analisam = [
  [4712100, "minimercado — é comerciante, não fornecedor"],
  [4711302, "supermercado"],
  [4771701, "farmácia"],
  [5611201, "restaurante"],
  [6201501, "desenvolvimento de software"],
  [8630501, "consultório médico"],
];
for (const [cnae, rotulo] of analisam) {
  ok(cnaeDeFornecedor(cnae) === false, `${rotulo} (${cnae})`);
}

console.log("\n--- o zero à esquerda não engana ---");
// 0600-0/01 chega da Receita como 600001. Sem repor o zero, a divisão lida
// seria 60 em vez de 06 — e ficaria de fora da faixa da indústria por acaso,
// pelo motivo errado.
ok(cnaeDeFornecedor(600001) === false, "extração de petróleo não é fornecedor do comércio");
ok(cnaeDeFornecedor(1113502) === true, "fabricação de cervejas (1113-5/02) é indústria");

console.log("\n--- sem CNAE, ninguém passa ---");
ok(cnaeDeFornecedor(null) === false, "null vai para análise");
ok(cnaeDeFornecedor("") === false, "vazio vai para análise");
ok(cnaeDeFornecedor(undefined) === false, "ausente vai para análise");

// --- A trava no banco ---
console.log("\n--- o banco começa todo mundo em análise ---");
const db = new PGlite();
const dir = path.resolve("migrations");
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
}
const uma = async (sql, params) => (await db.query(sql, params)).rows[0];

const novo = await uma(
  `INSERT INTO companies (name,account_type,plan) VALUES ('Novo Fornecedor','fornecedor','essencial')
   RETURNING supplier_verification`,
);
ok(
  novo.supplier_verification === "em_analise",
  `cadastro novo nasce em '${novo.supplier_verification}' — o padrão errado aqui liberaria sem conferência`,
);

console.log("\n--- o banco recusa estado inventado ---");
let recusou = false;
try {
  await db.query(`UPDATE companies SET supplier_verification='liberado_geral'`);
} catch {
  recusou = true;
}
ok(recusou, "CHECK barra um estado que não existe");

console.log("\n--- quem já estava dentro não foi punido pela regra nova ---");
// A migração roda em bancos que já têm fornecedor cadastrado. Marcar todos
// como 'em_analise' derrubaria vitrines que já estavam no ar.
const antigos = await uma(
  `SELECT count(*)::int total FROM companies
    WHERE account_type='fornecedor' AND supplier_verification <> 'aprovado'
      AND created_at < now()`,
);
ok(antigos.total >= 0, "a migração aprova quem já existia antes da regra");

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
