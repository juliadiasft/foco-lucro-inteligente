// A praça de Campinas: quem entra, em que ordem se liga, e quando o marco bate.
//
//   node scripts/praca.test.mjs
//
// Três peças leem a mesma definição (src/lib/praca.ts) e precisam concordar:
// o tipo de fornecedor em código e em SQL, a lista de ligação da prospecção e o
// medidor do marco. Se discordarem, o painel diz "praça fechada" contando
// empresas que a lista de ligação nunca mostrou — ou esconde o marco batido.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { tipoDeFornecedor, TIPO_SQL, pracaDaCidade, MARCO } = await import("../src/lib/praca.ts");
const { condicoesDosFiltros, ordemDaLista, filtros } =
  await import("../src/lib/prospeccao-consulta.ts");
const { medirPraca } = await import("../src/lib/medidor-praca.ts");

const db = new PGlite();
for (const arquivo of (await readdir(path.resolve("migrations")))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile(path.resolve("migrations", arquivo), "utf8"));
}

console.log("--- o tipo de fornecedor, em código e no banco ---");
// As sete atividades principais que existem na lista de fornecedores da região,
// escritas como a Receita escreve.
const ramos = [
  ["Comércio atacadista de alimentos para animais", "A"],
  ["Fabricação de alimentos para animais", "B"],
  ["Comércio atacadista de medicamentos e drogas de uso veterinário", "B"],
  ["Fabricação de medicamentos para uso veterinário", "B"],
  [
    "Comércio atacadista de outros equipamentos e artigos de uso pessoal e doméstico não especificados anteriormente",
    "C",
  ],
  ["Comércio atacadista de mercadorias em geral, com predominância de insumos agropecuários", "C"],
  ["Comércio atacadista de animais vivos", "C"],
];
for (const [ramo, esperado] of ramos) {
  const noBanco = (
    await db.query(`SELECT ${TIPO_SQL} AS tipo FROM (SELECT $1::text AS ramo_principal) p`, [ramo])
  ).rows[0].tipo;
  ok(
    tipoDeFornecedor(ramo) === esperado && noBanco === esperado,
    `${esperado} — ${ramo.slice(0, 60)} (código ${tipoDeFornecedor(ramo)}, banco ${noBanco})`,
  );
}

console.log("\n--- a cidade digitada cai na mesma praça que a da Receita ---");
ok(pracaDaCidade("SANTA BARBARA D'OESTE", "SP") === "campinas", "como a Receita grava");
ok(
  pracaDaCidade("Santa Bárbara d’Oeste", "sp") === "campinas",
  "como a pessoa digita, com acento e apóstrofo curvo",
);
ok(pracaDaCidade("  campinas ", "SP") === "campinas", "minúscula e espaço sobrando");
ok(pracaDaCidade("Campinas", "GO") === null, "Campinas de outro estado não é a praça");
ok(pracaDaCidade("Ribeirão Preto", "SP") === null, "cidade de SP fora da região não entra");

console.log("\n--- a lista de ligação da praça ---");
let seq = 0;
const empresa = async (nome, cidade, uf, ramo, extra = {}) => {
  seq += 1;
  await db.query(
    `INSERT INTO prospects (cnpj,razao_social,lado,cidade,uf,situacao,ramo_principal,
       whatsapp,email,nome_sugere_pet,contatos_iguais,matriz_ou_filial)
     VALUES ($1,$2,'fornecedor',$3,$4,'Ativa',$5,$6,$7,$8,$9,$10)`,
    [
      String(10000000000000 + seq),
      nome,
      cidade,
      uf,
      ramo,
      extra.whatsapp ?? "",
      extra.email ?? "",
      extra.pet ?? false,
      extra.contatos ?? 1,
      extra.filial ? "filial" : "unica",
    ],
  );
};
const [A, B, , , C] = ramos.map((r) => r[0]);
await empresa("B CAMPINAS FABRICA", "CAMPINAS", "SP", B);
await empresa("A PIRACICABA DISTRIBUIDORA", "PIRACICABA", "SP", A);
await empresa("A CAMPINAS DISTRIBUIDORA", "CAMPINAS", "SP", A);
await empresa("A VALINHOS PET", "VALINHOS", "SP", A, { pet: true, whatsapp: "19999990000" });
await empresa("A VALINHOS SEM PET", "VALINHOS", "SP", A, { whatsapp: "19999990001" });
await empresa("C CAMPINAS PET MAIS", "CAMPINAS", "SP", C, { pet: true });
await empresa("C CAMPINAS UTILIDADES", "CAMPINAS", "SP", C);
await empresa("A CAMPINAS CENTRAL", "CAMPINAS", "SP", A, { contatos: 40 });
await empresa("A CAMPINAS FILIAL", "CAMPINAS", "SP", A, { filial: true });
await empresa("A RIBEIRAO FORA", "RIBEIRAO PRETO", "SP", A);
await empresa("A VALINHOS MG", "VALINHOS", "MG", A);

const listar = async (entrada) => {
  const data = filtros.parse(entrada);
  const { onde, valores } = condicoesDosFiltros(data);
  return (
    await db.query(
      `SELECT p.razao_social FROM prospects p WHERE ${onde} ${ordemDaLista(data)}`,
      valores,
    )
  ).rows.map((r) => r.razao_social);
};

const praca = await listar({ lado: "fornecedor", praca: "campinas", quemDecide: true });
ok(!praca.includes("A RIBEIRAO FORA"), "cidade de SP fora da região fica de fora");
ok(!praca.includes("A VALINHOS MG"), "cidade com o mesmo nome em outro estado fica de fora");
ok(!praca.includes("A CAMPINAS FILIAL"), "filial fica de fora com 'só quem decide'");
ok(praca.length === 8, `oito empresas da praça (${praca.length})`);

const esperada = [
  "A CAMPINAS DISTRIBUIDORA",
  "A VALINHOS PET",
  "A VALINHOS SEM PET",
  "A PIRACICABA DISTRIBUIDORA",
  "B CAMPINAS FABRICA",
  "C CAMPINAS PET MAIS",
  "C CAMPINAS UTILIDADES",
  "A CAMPINAS CENTRAL",
];
ok(
  praca.join("|") === esperada.join("|"),
  "ordem das ligações:\n        " + praca.join("\n        "),
);

const soA = await listar({ lado: "fornecedor", praca: "campinas", tipo: "A", quemDecide: true });
ok(soA.every((n) => n.startsWith("A ")) && soA.length === 5, `filtro por tipo A (${soA.length})`);

// Estado e cidade vindos da tela não podem somar com a praça.
const conflito = await listar({
  lado: "fornecedor",
  praca: "campinas",
  uf: "MG",
  cidade: "VALINHOS",
});
ok(
  conflito.includes("A CAMPINAS DISTRIBUIDORA") && !conflito.includes("A VALINHOS MG"),
  "com praça escolhida, estado e cidade da tela são ignorados",
);

const semPraca = await listar({ lado: "fornecedor", uf: "MG" });
ok(
  semPraca.length === 1 && semPraca[0] === "A VALINHOS MG",
  "sem praça, o filtro de estado continua como era",
);

console.log("\n--- o medidor do marco ---");
const f = (empresaId, cidade, item, preco = true, uf = "SP") => ({
  empresa: empresaId,
  tipoDeConta: "fornecedor",
  cidade,
  uf,
  itemId: item,
  itemNome: item ? `Ração ${item}` : null,
  temPreco: preco,
});
const loja = (id, cidade, uf = "SP") => ({
  empresa: id,
  tipoDeConta: "comerciante",
  cidade,
  uf,
  itemId: null,
  itemNome: null,
  temPreco: false,
});

const quase = medirPraca(
  [
    f("f1", "Campinas", "golden15"),
    f("f1", "Campinas", "golden15"), // mesma ração em outra embalagem
    f("f2", "Valinhos", "golden15"),
    f("f3", "Santa Bárbara d’Oeste", "golden15"),
    f("f3", "Santa Bárbara d’Oeste", "premier", false), // sob consulta
    f("f4", "Sumaré", "premier"),
    f("f5", "Hortolândia", null), // vitrine sem item
    f("f6", "Ribeirão Preto", "golden15"), // fora da praça
    f("f7", "Campinas", "golden15", true, "GO"), // Campinas de Goiás
    loja("l1", "Campinas"),
    loja("l2", "Paulínia"),
    loja("l3", "São Paulo"),
  ],
  "campinas",
);
ok(quase.vitrines === 5, `vitrines na praça: 5 (${quase.vitrines})`);
ok(quase.fornecedoresComPreco === 4, `com preço: 4 (${quase.fornecedoresComPreco})`);
ok(
  quase.itens.find((i) => i.nome === "Ração golden15")?.fornecedores === 3,
  "a mesma ração em duas embalagens conta o fornecedor uma vez só",
);
ok(
  !quase.itens.some((i) => i.nome === "Ração premier"),
  "item sob consulta não conta como comparável",
);
ok(quase.itensEmComum === 1, `itens em comum entre 3+: 1 (${quase.itensEmComum})`);
ok(quase.petShops === 2, `pet shops da praça: 2 (${quase.petShops})`);
ok(!quase.marcoBatido, "5 vitrines com 1 item em comum: marco NÃO batido");

const itens = Array.from({ length: MARCO.itensEmComum }, (_v, i) => `racao${i}`);
const cheio = medirPraca(
  ["f1", "f2", "f3", "f4", "f5"].flatMap((id) => itens.map((item) => f(id, "Campinas", item))),
  "campinas",
);
ok(
  cheio.itensEmComum === 10 && cheio.vitrines === 5 && cheio.marcoBatido,
  "5 vitrines e 10 rações em comum: marco batido",
);
const quatro = medirPraca(
  ["f1", "f2", "f3", "f4"].flatMap((id) => itens.map((item) => f(id, "Campinas", item))),
  "campinas",
);
ok(!quatro.marcoBatido, "com 4 vitrines, mesmo com os itens, ainda não");

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
