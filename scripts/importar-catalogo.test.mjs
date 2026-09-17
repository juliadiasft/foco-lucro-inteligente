// A equipe subindo tabela de preço pelo fornecedor (cadastro assistido).
//
//   node scripts/importar-catalogo.test.mjs
//
// Agora existem DUAS portas para a mesma coisa: o fornecedor importando na
// conta dele, e a equipe importando por ele no back office. O risco não é uma
// delas quebrar — é as duas continuarem funcionando com regras diferentes.
// Uma respeitando o limite do plano e a outra não, uma atualizando preço e a
// outra duplicando a oferta. A diferença só apareceria como preço errado na
// comparação, que é o pior lugar possível para descobrir, porque é onde o
// comerciante decide a compra.
//
// Por isso o teste roda contra o núcleo compartilhado, com banco de verdade e
// as migrações aplicadas.
//
// O que ele NÃO cobre: a sessão de staff em si (exige servidor no ar). A regra
// de quem pode usar está testada abaixo pela função pura que requireStaff usa.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { aplicarOfertasDoFornecedor, linhaDeOfertaSchema } =
  await import("../src/lib/server/importar-ofertas.server.ts");
const { podeUsar } = await import("../src/lib/permissao-da-equipe.ts");

const db = new PGlite();
for (const arquivo of (await readdir(path.resolve("migrations")))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile(path.resolve("migrations", arquivo), "utf8"));
}

const fornecedor = (
  await db.query(
    `INSERT INTO companies (name, account_type, plan, city, uf)
     VALUES ('Distribuidora Pet Campinas','fornecedor','profissional','CAMPINAS','SP')
     RETURNING id`,
  )
).rows[0].id;

const linha = (n, nome, packSize, price) => ({
  linha: n,
  name: nome,
  brand: "Marca",
  baseUnit: "kg",
  packSize,
  price,
  minimumQuantity: 1,
});

console.log("--- a tabela sobe ---");
let r = await aplicarOfertasDoFornecedor(db, fornecedor, [
  linha(1, "Racao Adulto Frango", 15, 120.5),
  linha(2, "Racao Filhote", 10.1, 98),
  linha(3, "Areia Higienica", 4, 22),
]);
ok(r.criados === 3, `três linhas viram três ofertas (${r.criados})`);
ok(r.atualizados === 0 && r.ignorados.length === 0, "nada ignorado, nada atualizado");

console.log("\n--- subir de novo é atualizar preço, não duplicar oferta ---");
// É o caso real: o distribuidor manda a tabela nova do mês. Se duplicasse, a
// vitrine passaria a mostrar o mesmo item duas vezes com preços diferentes.
r = await aplicarOfertasDoFornecedor(db, fornecedor, [linha(1, "Racao Adulto Frango", 15, 131.9)]);
ok(r.atualizados === 1 && r.criados === 0, `mesmo item e embalagem atualiza (${r.atualizados})`);
const precos = await db.query(
  `SELECT o.price::text FROM supplier_offerings o
     JOIN catalog_items c ON c.id=o.catalog_item_id
    WHERE o.company_id=$1 AND c.name='Racao Adulto Frango'`,
  [fornecedor],
);
ok(precos.rows.length === 1, `continua existindo UMA oferta do item (${precos.rows.length})`);
ok(Number(precos.rows[0].price) === 131.9, `o preço é o novo (${precos.rows[0].price})`);

console.log("\n--- embalagem diferente é oferta diferente ---");
r = await aplicarOfertasDoFornecedor(db, fornecedor, [linha(1, "Racao Adulto Frango", 25, 190)]);
ok(r.criados === 1, "o mesmo produto em 25kg é outra oferta, e não sobrescreve a de 15kg");

console.log("\n--- o que a planilha traz torto ---");
// Linha sem nome tem duas barreiras, e as duas importam. O schema é a que vale
// para as duas portas, porque as duas validam a entrada antes de chamar o
// núcleo; o núcleo é a rede embaixo, para o caso de alguém chamá-lo direto.
ok(
  !linhaDeOfertaSchema.safeParse({ ...linha(7, "   ", 5, 10), brand: "Marca" }).success,
  "o schema recusa linha sem nome, mesmo com a marca preenchida",
);
r = await aplicarOfertasDoFornecedor(db, fornecedor, [
  { ...linha(7, "   ", 5, 10), brand: undefined },
]);
ok(
  r.criados === 0 && r.ignorados[0]?.linha === 7,
  "no núcleo, linha sem nome é ignorada COM o número da linha, para achar na planilha",
);
r = await aplicarOfertasDoFornecedor(db, fornecedor, [linha(8, "Petisco Sem Preco", 1, null)]);
ok(r.criados === 1, "item sem preço entra: 'sob consulta' é oferta válida, só não compara");

console.log("\n--- o limite do plano vale para as duas portas ---");
// O limite é do plano do FORNECEDOR, não de quem está importando. Sem isto, a
// importação da equipe seria um jeito de dar plano maior sem pagar.
await db.query("UPDATE companies SET plan='essencial' WHERE id=$1", [fornecedor]);
const { planLimits } = await import("../src/lib/plans.ts");
const teto = planLimits.essencial.products;
const muitas = [];
for (let i = 0; i < teto + 5; i++) muitas.push(linha(100 + i, `Item Extra ${i}`, 1, 10));
r = await aplicarOfertasDoFornecedor(db, fornecedor, muitas);
ok(
  r.ignorados.some((i) => i.motivo === "Limite de itens do plano atingido"),
  "passou do teto do plano do fornecedor e parou, com motivo escrito",
);
const ativos = await db.query(
  "SELECT count(*)::text total FROM supplier_offerings WHERE company_id=$1 AND active=true",
  [fornecedor],
);
ok(
  Number(ativos.rows[0].total) <= teto,
  `o total ativo não passa do limite do plano (${ativos.rows[0].total} de ${teto})`,
);

console.log("\n--- importar NÃO publica a vitrine ---");
// Preço de terceiro não vira página pública sem ele ter olhado. Se algum dia
// isto passar a publicar sozinho, é aqui que quebra.
const vitrine = await db.query(
  "SELECT count(*)::text total FROM supplier_profiles WHERE company_id=$1 AND published=true",
  [fornecedor],
);
ok(Number(vitrine.rows[0].total) === 0, "nenhuma vitrine foi publicada pela importação");

console.log("\n--- o carimbo de quem subiu ---");
const antes = await db.query("SELECT catalogo_importado_em FROM companies WHERE id=$1", [
  fornecedor,
]);
ok(
  antes.rows[0].catalogo_importado_em === null,
  "importação do próprio fornecedor não carimba nada",
);
await db.query(
  "UPDATE companies SET catalogo_importado_em=now(), catalogo_importado_por=$2 WHERE id=$1",
  [fornecedor, "equipe@central"],
);
const depois = await db.query(
  "SELECT catalogo_importado_em, catalogo_importado_por FROM companies WHERE id=$1",
  [fornecedor],
);
ok(
  depois.rows[0].catalogo_importado_em !== null &&
    depois.rows[0].catalogo_importado_por === "equipe@central",
  "a conta guarda a data e o e-mail de quem da equipe subiu",
);

console.log("\n--- empresa que não existe ---");
let erro = null;
try {
  await aplicarOfertasDoFornecedor(db, "00000000-0000-0000-0000-000000000000", [
    linha(1, "Racao", 1, 10),
  ]);
} catch (e) {
  erro = e;
}
ok(erro !== null, "importar para empresa inexistente falha em vez de criar oferta órfã");

console.log("\n--- quem da equipe pode importar ---");
ok(podeUsar("admin", ["admin", "suporte"]), "admin pode");
ok(podeUsar("suporte", ["admin", "suporte"]), "suporte pode: é quem faz cadastro assistido");
ok(!podeUsar("financeiro", ["admin", "suporte"]), "financeiro NÃO pode: não mexe com catálogo");
ok(podeUsar("admin", ["financeiro"]), "admin passa em qualquer área, por definição");
ok(podeUsar("suporte"), "sem lista de papéis, basta ser da equipe");

await db.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
