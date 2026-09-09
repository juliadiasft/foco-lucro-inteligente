// Testa os sinais de economia — o aviso de que um fornecedor da Central vende
// mais barato algo que o comerciante já compra.
//
//   node scripts/signals.test.mjs
//
// A primeira parte importa a decisão de verdade (src/lib/signals.ts), não uma
// cópia dela. É onde moram os erros caros: comparar quilo com unidade, avisar
// por centavos, escolher a oferta errada.
//
// A segunda parte roda a consulta contra um Postgres de verdade, para garantir
// que fornecedor despublicado, oferta esgotada e o próprio catálogo do
// comerciante ficam de fora.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

// Sem catch silencioso: um import quebrado tem que falhar o teste, não fazer
// ele "passar" pulando tudo. Foi assim que a primeira versão deste arquivo
// passou sem executar uma única verificação.
const { avaliarSinal, priorizar, MAXIMO_POR_RODADA } = await import("../src/lib/signals.ts");

const oferta = (extra = {}) => ({
  fornecedorId: "f1",
  fornecedor: "Atacadão Pet",
  baseUnit: "kg",
  packSize: 15,
  price: 165,
  promoPrice: null,
  promoUntil: null,
  minimumQuantity: 1,
  ...extra,
});

console.log("--- acha economia de verdade ---");
// Paga R$ 14/kg, o fornecedor vende o saco de 15 kg por R$ 165 = R$ 11/kg.
const achou = avaliarSinal(
  { id: "p1", nome: "Ração para cães adultos", unidade: "kg", custo: 14 },
  [oferta()],
);
ok(Boolean(achou), "encontra a oferta mais barata");
ok(
  achou && Math.abs(achou.precoFornecedor - 11) < 0.001,
  `preço por quilo do fornecedor: R$ ${achou?.precoFornecedor.toFixed(2)}`,
);
ok(
  achou && Math.abs(achou.economiaNaCompra - 45) < 0.001,
  `economia no saco de 15 kg: R$ ${achou?.economiaNaCompra.toFixed(2)}`,
);

console.log("\n--- NÃO compara unidades diferentes ---");
// O caso que estraga a confiança: o nome casa, mas um é por quilo e o outro
// por unidade. R$/kg contra R$/un daria um número errado sobre dinheiro.
ok(
  avaliarSinal({ id: "p1", nome: "Ração", unidade: "un", custo: 14 }, [
    oferta({ baseUnit: "kg" }),
  ]) === null,
  "produto em unidade não casa com oferta em quilo",
);
ok(
  avaliarSinal({ id: "p1", nome: "Ração", unidade: "caixa com 12", custo: 14 }, [oferta()]) ===
    null,
  "unidade que o sistema não reconhece não gera aviso nenhum",
);

console.log("\n--- não avisa por pouco ---");
ok(
  avaliarSinal({ id: "p1", nome: "Ração", unidade: "kg", custo: 11.5 }, [oferta()]) === null,
  "economia de 4% fica abaixo do piso e não vira aviso",
);
ok(
  avaliarSinal({ id: "p1", nome: "Sabonete", unidade: "un", custo: 2 }, [
    oferta({ baseUnit: "un", packSize: 1, price: 1, minimumQuantity: 1 }),
  ]) === null,
  "50% de desconto em item barato não passa do piso de R$ 20 na compra",
);
ok(
  avaliarSinal({ id: "p1", nome: "Ração", unidade: "kg", custo: 10 }, [oferta()]) === null,
  "fornecedor mais caro que o custo atual não vira aviso",
);

console.log("\n--- escolhe a melhor oferta, não a primeira ---");
const entreVarias = avaliarSinal({ id: "p1", nome: "Ração", unidade: "kg", custo: 14 }, [
  oferta({ fornecedorId: "f1", fornecedor: "Caro", packSize: 10, price: 125 }),
  oferta({ fornecedorId: "f2", fornecedor: "Barato", packSize: 20, price: 200 }),
  oferta({ fornecedorId: "f3", fornecedor: "Medio", packSize: 15, price: 172.5 }),
]);
ok(entreVarias?.fornecedor === "Barato", `escolheu ${entreVarias?.fornecedor} (R$ 10,00/kg)`);

console.log("\n--- a promoção no prazo vale; a vencida não ---");
// Dez dias para cada lado, e não um: o toISOString devolve UTC, e no fuso do
// Brasil "ontem em UTC" ainda pode ser hoje aqui — foi assim que a primeira
// versão deste teste acusou uma falha que não existia no código.
const amanha = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const ontem = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
const comPromo = avaliarSinal({ id: "p1", nome: "Ração", unidade: "kg", custo: 14 }, [
  oferta({ price: 210, promoPrice: 150, promoUntil: amanha }),
]);
ok(
  comPromo && Math.abs(comPromo.precoFornecedor - 10) < 0.001,
  `promoção válida usa R$ ${comPromo?.precoFornecedor.toFixed(2)}/kg`,
);
ok(
  avaliarSinal({ id: "p1", nome: "Ração", unidade: "kg", custo: 14 }, [
    oferta({ price: 210, promoPrice: 150, promoUntil: ontem }),
  ]) === null,
  "promoção vencida volta ao preço de tabela e não vira aviso",
);

console.log("\n--- prioriza pelo dinheiro e limita a enxurrada ---");
const muitos = Array.from({ length: 9 }, (_, i) => ({
  produtoId: `p${i}`,
  produto: `Item ${i}`,
  fornecedorId: "f1",
  fornecedor: "F",
  precoAtual: 10,
  precoFornecedor: 5,
  economiaPorUnidade: 5,
  economiaNaCompra: (i + 1) * 10,
  percentual: 50,
}));
const escolhidos = priorizar(muitos);
ok(escolhidos.length === MAXIMO_POR_RODADA, `manda no máximo ${MAXIMO_POR_RODADA} por rodada`);
ok(escolhidos[0].economiaNaCompra === 90, "o de maior economia vem primeiro");

// --- Agora a consulta, contra banco de verdade ---
console.log("\n--- a busca no banco ---");
const db = new PGlite();
const dir = path.resolve("migrations");
for (const arquivo of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(dir, arquivo), "utf8"));
}
const uma = async (sql, params) => (await db.query(sql, params)).rows[0];

const comerciante = (
  await db.query(
    `INSERT INTO companies (name,account_type,plan) VALUES ('Pet da Esquina','comerciante','profissional') RETURNING id`,
  )
).rows[0].id;

const criarFornecedor = async (nome, publicado) => {
  const id = (
    await db.query(
      `INSERT INTO companies (name,account_type,plan) VALUES ($1,'fornecedor','essencial') RETURNING id`,
      [nome],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO supplier_profiles (company_id,display_name,published,slug) VALUES ($1,$2,$3,$4)`,
    [id, nome, publicado, nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")],
  );
  return id;
};

const publicado = await criarFornecedor("Atacadao Publicado", true);
const oculto = await criarFornecedor("Atacadao Oculto", false);

const item = (
  await db.query(
    `INSERT INTO catalog_items (name,brand,base_unit,search_key,category_id)
     VALUES ('Ração para cães adultos',null,'kg','racao para caes adultos','pet') RETURNING id`,
  )
).rows[0].id;

const inserirOferta = (empresa, preco, disponibilidade = "disponivel") =>
  db.query(
    `INSERT INTO supplier_offerings (company_id,catalog_item_id,pack_size,price,minimum_quantity,availability,active)
     VALUES ($1,$2,15,$3,1,$4,true)`,
    [empresa, item, preco, disponibilidade],
  );

await inserirOferta(publicado, 165);
await inserirOferta(oculto, 90);

// A mesma consulta do signals.server.ts.
const buscar = (chave, unidade) =>
  db.query(
    `SELECT coalesce(sp.display_name, c.name) fornecedor, o.price
       FROM supplier_offerings o
       JOIN catalog_items ci ON ci.id=o.catalog_item_id
       JOIN supplier_profiles sp ON sp.company_id=o.company_id AND sp.published=true
       JOIN companies c ON c.id=sp.company_id AND c.account_type='fornecedor'
      WHERE o.active=true AND o.availability <> 'esgotado'
        AND ci.search_key=$1 AND ci.base_unit=$2 AND o.company_id <> $3`,
    [chave, unidade, comerciante],
  );

const encontradas = await buscar("racao para caes adultos", "kg");
ok(encontradas.rows.length === 1, `só a vitrine publicada entra: ${encontradas.rows.length}`);
ok(
  encontradas.rows[0]?.fornecedor === "Atacadao Publicado",
  "o fornecedor oculto, mesmo mais barato, fica de fora",
);

await db.query(`UPDATE supplier_offerings SET availability='esgotado' WHERE company_id=$1`, [
  publicado,
]);
ok((await buscar("racao para caes adultos", "kg")).rows.length === 0, "oferta esgotada não conta");

console.log("\n--- o comerciante não se compara consigo mesmo ---");
await db.query(
  `INSERT INTO supplier_profiles (company_id,display_name,published,slug)
   VALUES ($1,'Pet da Esquina',true,'pet-da-esquina')`,
  [comerciante],
);
await inserirOferta(comerciante, 50);
ok(
  (await buscar("racao para caes adultos", "kg")).rows.length === 0,
  "oferta da própria empresa é excluída da busca",
);

console.log("\n--- a deduplicação ---");
const gravar = (chave) =>
  uma(
    `INSERT INTO notifications (company_id,type,title,message,dedupe_key)
     VALUES ($1,'supplier_opportunity','t','m',$2)
     ON CONFLICT (company_id,dedupe_key) DO NOTHING RETURNING id`,
    [comerciante, chave],
  );
ok(Boolean(await gravar("sinal:abc")), "o primeiro aviso é gravado");
ok((await gravar("sinal:abc")) === undefined, "o mesmo achado não avisa de novo");
ok(Boolean(await gravar("sinal:def")), "preço novo, chave nova, avisa de novo");

await db.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas.length ? 1 : 0);
