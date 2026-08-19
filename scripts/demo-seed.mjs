// Popula o banco LOCAL com um cenario de demonstracao de pet shop:
// tres fornecedores publicados, com os mesmos produtos a precos diferentes,
// para que a comparacao tenha o que comparar.
//
// Rode com o servidor PARADO:
//   node scripts/demo-seed.mjs
//
// Nunca aponta para producao: usa o PGlite de .local-data.
import path from "node:path";
import process from "node:process";

import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create(path.resolve(".local-data/central-comerciante"));
const uma = async (sql, params) => (await db.query(sql, params)).rows[0];

const chave = (nome, marca) => {
  const n = (v) =>
    v
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return [n(marca || ""), n(nome)].filter(Boolean).join(" ");
};

// --- Catalogo canonico: o mesmo item para todos os fornecedores, que e o
// --- que torna a comparacao possivel.
const itens = [
  { nome: "Ração para cães adultos", marca: "Premium Life", unidade: "kg" },
  { nome: "Areia sanitária para gatos", marca: "CleanCat", unidade: "kg" },
  { nome: "Shampoo antipulgas", marca: "PetCare", unidade: "l" },
];

const idsItens = {};
for (const item of itens) {
  const existente = await uma(`SELECT id FROM catalog_items WHERE search_key=$1`, [
    chave(item.nome, item.marca),
  ]);
  idsItens[item.nome] = existente
    ? existente.id
    : (
        await uma(
          `INSERT INTO catalog_items (name,brand,base_unit,search_key,category_id)
           VALUES ($1,$2,$3,$4,'pet') RETURNING id`,
          [item.nome, item.marca, item.unidade, chave(item.nome, item.marca)],
        )
      ).id;
}
console.log(`${itens.length} itens no catalogo canonico`);

// --- Fornecedores. O primeiro ja existe (criado pela tela de cadastro).
const fornecedores = [
  {
    email: "fornecedor.demo@teste.local",
    nome: "Atacadão Pet Sul (DEMO)",
    cidade: "Curitiba",
    uf: "PR",
    prazo: 7,
    minimo: 300,
    // Embalagem grande e barata por quilo: o caso que a comparacao existe
    // para revelar.
    ofertas: [
      { item: "Ração para cães adultos", pack: 15, preco: 165.0, promo: null },
      { item: "Areia sanitária para gatos", pack: 12, preco: 66.0, promo: null },
      { item: "Shampoo antipulgas", pack: 1, preco: 32.0, promo: null },
    ],
  },
  {
    email: "pet.distribuidora.minas@teste.local",
    nome: "Pet Distribuidora Minas",
    cidade: "Uberlândia",
    uf: "MG",
    prazo: 3,
    minimo: 200,
    ofertas: [
      // Caixa menor e mais cara por quilo, mas entrega mais rapida.
      { item: "Ração para cães adultos", pack: 10, preco: 118.0, promo: null },
      { item: "Areia sanitária para gatos", pack: 12, preco: 60.0, promo: null },
      { item: "Shampoo antipulgas", pack: 1, preco: 28.5, promo: null },
    ],
  },
  {
    email: "distribuidora.pet.brasil@teste.local",
    nome: "Distribuidora Pet Brasil",
    cidade: "Ribeirão Preto",
    uf: "SP",
    prazo: 5,
    minimo: 500,
    ofertas: [
      // Preco de tabela alto, mas em promocao vence — e o caso que prova que
      // o ranking usa o preco que o comerciante vai pagar de verdade.
      { item: "Ração para cães adultos", pack: 20, preco: 240.0, promo: 196.0 },
      { item: "Areia sanitária para gatos", pack: 20, preco: 118.0, promo: null },
      {
        item: "Shampoo antipulgas",
        pack: 1,
        preco: 35.0,
        promo: null,
        disponibilidade: "esgotado",
      },
    ],
  },
];

const daquiUmMes = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

for (const f of fornecedores) {
  let empresa = await uma(
    `SELECT c.id FROM companies c JOIN users u ON u.company_id=c.id WHERE lower(u.email)=$1`,
    [f.email],
  );

  if (!empresa) {
    empresa = await uma(
      `INSERT INTO companies (name,account_type,city,uf,plan,subscription_status)
       VALUES ($1,'fornecedor',$2,$3,'premium','trialing') RETURNING id`,
      [f.nome, f.cidade, f.uf],
    );
    // Senha igual a dos outros demos, so para o cenario local.
    await db.query(
      `INSERT INTO users (company_id,name,email,password_hash,role)
       VALUES ($1,$2,$3,'$2a$10$demolocalsemvalorreal','owner')`,
      [empresa.id, f.nome, f.email],
    );
    console.log(`criado: ${f.nome}`);
  } else {
    console.log(`ja existia: ${f.nome}`);
  }

  await db.query(
    `INSERT INTO company_segments (company_id,segment_id) VALUES ($1,'pet')
     ON CONFLICT DO NOTHING`,
    [empresa.id],
  );

  await db.query(
    `INSERT INTO supplier_profiles
       (company_id,display_name,description,delivery_days,minimum_order,published,public_phone,payment_terms)
     VALUES ($1,$2,$3,$4,$5,true,$6,'30 dias no boleto')
     ON CONFLICT (company_id) DO UPDATE SET
       display_name=excluded.display_name, delivery_days=excluded.delivery_days,
       minimum_order=excluded.minimum_order, published=true`,
    [
      empresa.id,
      f.nome,
      `Distribuidora de produtos para pet shops em ${f.cidade} e região, com entrega própria.`,
      f.prazo,
      f.minimo,
      "(00) 0000-0000",
    ],
  );

  for (const o of f.ofertas) {
    const jaTem = await uma(
      `SELECT id FROM supplier_offerings WHERE company_id=$1 AND catalog_item_id=$2`,
      [empresa.id, idsItens[o.item]],
    );
    if (jaTem) {
      await db.query(
        `UPDATE supplier_offerings SET pack_size=$2,price=$3,promo_price=$4,
           promo_until=$5,availability=$6,active=true WHERE id=$1`,
        [
          jaTem.id,
          o.pack,
          o.preco,
          o.promo,
          o.promo ? daquiUmMes : null,
          o.disponibilidade || "disponivel",
        ],
      );
    } else {
      await db.query(
        `INSERT INTO supplier_offerings
           (company_id,catalog_item_id,pack_size,price,promo_price,promo_until,
            minimum_quantity,delivery_days,availability,stock)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,100)`,
        [
          empresa.id,
          idsItens[o.item],
          o.pack,
          o.preco,
          o.promo,
          o.promo ? daquiUmMes : null,
          f.prazo,
          o.disponibilidade || "disponivel",
        ],
      );
    }
  }
}

// O comerciante precisa estar no nicho pet para a busca filtrada achar.
const comerciante = await uma(
  `SELECT c.id FROM companies c JOIN users u ON u.company_id=c.id
    WHERE lower(u.email)='comerciante.demo@teste.local'`,
);
if (comerciante) {
  await db.query(
    `INSERT INTO company_segments (company_id,segment_id) VALUES ($1,'pet')
     ON CONFLICT DO NOTHING`,
    [comerciante.id],
  );
  // Devolve o comerciante para um estado utilizavel depois dos testes de
  // webhook, que o deixaram cancelado.
  await db.query(
    `UPDATE companies SET plan='profissional', subscription_status='trialing',
       trial_ends_at=now()+interval '7 days' WHERE id=$1`,
    [comerciante.id],
  );
  console.log("comerciante demo: nicho pet, plano profissional em teste");
}

console.log("\n--- o que o comerciante vai ver ---");
const comparacao = await db.query(
  `SELECT ci.name, sp.display_name, comp.city, o.pack_size,
          o.price, o.promo_price,
          round(coalesce(o.promo_price,o.price)/o.pack_size, 2) por_unidade,
          o.availability
     FROM supplier_offerings o
     JOIN catalog_items ci ON ci.id=o.catalog_item_id
     JOIN supplier_profiles sp ON sp.company_id=o.company_id AND sp.published
     JOIN companies comp ON comp.id=o.company_id
    ORDER BY ci.name, por_unidade`,
);
let atual = "";
for (const r of comparacao.rows) {
  if (r.name !== atual) {
    console.log(`\n${r.name}`);
    atual = r.name;
  }
  const promo = r.promo_price ? ` (promo, tabela ${r.price})` : "";
  const esgotado = r.availability === "esgotado" ? "  [ESGOTADO]" : "";
  console.log(
    `  R$ ${String(r.por_unidade).padStart(6)} /un  ${r.display_name} — ${r.city}${promo}${esgotado}`,
  );
}

await db.close();
console.log("\nPronto. Suba o servidor e entre como comerciante.demo@teste.local");
process.exit(0);
