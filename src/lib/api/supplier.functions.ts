import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  catalogSearchKey,
  effectivePrice,
  type Availability,
  type BaseUnit,
  type PriceTier,
} from "../catalog";
import { planLimits, type PlanName } from "../plans";
import { requireActiveSession, requireAdmin, type SessionUser } from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { slugOrFallback } from "../slug";

// Endereço da vitrine pública. Nasce do nome na primeira gravação e nunca mais
// muda: o fornecedor manda esse link em grupo de WhatsApp e o Google guarda a
// página. Trocar depois quebraria os dois de uma vez.
async function garantirSlug(companyId: string, displayName: string) {
  const atual = await query<{ slug: string | null }>(
    "SELECT slug FROM supplier_profiles WHERE company_id=$1",
    [companyId],
  );
  if (atual.rows[0]?.slug) return atual.rows[0].slug;

  const base = slugOrFallback(displayName);
  // Dois fornecedores com o mesmo nome existem. O segundo ganha sufixo em vez
  // de derrubar a gravação com erro de índice único.
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    const candidato = tentativa === 0 ? base : `${base}-${tentativa + 1}`;
    const ocupado = await query("SELECT 1 FROM supplier_profiles WHERE slug=$1", [candidato]);
    if (!ocupado.rows.length) return candidato;
  }
  return `${base}-${companyId.slice(0, 8)}`;
}

// Toda função daqui é do fornecedor. Um comerciante nunca deve editar vitrine
// nem catálogo de ninguém.
function requireSupplier(user: SessionUser) {
  if (user.accountType !== "fornecedor") throw new Error("Área exclusiva de fornecedores");
  return user;
}

export const getSupplierProfile = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  const result = await query<{
    display_name: string;
    description: string | null;
    delivery_days: number | null;
    minimum_order: string | null;
    public_phone: string | null;
    public_email: string | null;
    payment_terms: string | null;
    commercial_terms: string | null;
    published: boolean;
    slug: string | null;
  }>(
    `SELECT sp.display_name,sp.description,sp.delivery_days,sp.minimum_order,
            sp.public_phone,sp.public_email,sp.payment_terms,sp.commercial_terms,
            sp.published,sp.slug
       FROM supplier_profiles sp WHERE sp.company_id=$1`,
    [user.companyId],
  );
  const row = result.rows[0];
  if (!row)
    return {
      displayName: user.companyName,
      description: null,
      deliveryDays: null,
      minimumOrder: null,
      publicPhone: null,
      publicEmail: null,
      paymentTerms: null,
      commercialTerms: null,
      published: false,
      slug: null,
      exists: false,
    };
  return {
    displayName: row.display_name,
    description: row.description,
    deliveryDays: row.delivery_days,
    minimumOrder: row.minimum_order === null ? null : Number(row.minimum_order),
    publicPhone: row.public_phone,
    publicEmail: row.public_email,
    paymentTerms: row.payment_terms,
    commercialTerms: row.commercial_terms,
    published: row.published,
    slug: row.slug,
    exists: true,
  };
});

export const saveSupplierProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      displayName: z.string().trim().min(2).max(160),
      description: z.string().trim().max(1000).optional(),
      deliveryDays: z.number().int().min(0).max(365).nullable().optional(),
      minimumOrder: z.number().min(0).max(9999999).nullable().optional(),
      publicPhone: z.string().trim().max(30).optional(),
      publicEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
      paymentTerms: z.string().trim().max(300).optional(),
      commercialTerms: z.string().trim().max(600).optional(),
      published: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    requireAdmin(user);
    const slug = await garantirSlug(user.companyId, data.displayName);
    await query(
      `INSERT INTO supplier_profiles
         (company_id,display_name,description,delivery_days,minimum_order,public_phone,
          public_email,payment_terms,commercial_terms,published,slug)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (company_id) DO UPDATE SET
         display_name=excluded.display_name,description=excluded.description,
         delivery_days=excluded.delivery_days,minimum_order=excluded.minimum_order,
         public_phone=excluded.public_phone,public_email=excluded.public_email,
         payment_terms=excluded.payment_terms,commercial_terms=excluded.commercial_terms,
         published=excluded.published,updated_at=now(),
         -- O endereço já publicado permanece: coalesce só preenche quem ainda
         -- não tem.
         slug=coalesce(supplier_profiles.slug, excluded.slug)`,
      [
        user.companyId,
        data.displayName,
        data.description || null,
        data.deliveryDays ?? null,
        data.minimumOrder ?? null,
        data.publicPhone || null,
        data.publicEmail || null,
        data.paymentTerms || null,
        data.commercialTerms || null,
        data.published,
        slug,
      ],
    );
    return { ok: true, slug };
  });

type OfferingRow = {
  id: string;
  name: string;
  brand: string | null;
  base_unit: BaseUnit;
  category_id: string | null;
  description: string | null;
  sku: string | null;
  pack_size: string;
  price: string | null;
  promo_price: string | null;
  promo_until: Date | null;
  availability: Availability;
  stock: string | null;
  minimum_quantity: string;
  delivery_days: number | null;
};

function mapOffering(row: OfferingRow, tiers: PriceTier[]) {
  const price = row.price === null ? null : Number(row.price);
  const promoPrice = row.promo_price === null ? null : Number(row.promo_price);
  const promoUntil = row.promo_until ? row.promo_until.toISOString().slice(0, 10) : null;
  const packSize = Number(row.pack_size);
  const vigente = effectivePrice(price, promoPrice, promoUntil);
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    baseUnit: row.base_unit,
    categoryId: row.category_id,
    description: row.description,
    sku: row.sku,
    packSize,
    price,
    promoPrice,
    promoUntil,
    precoVigente: vigente,
    availability: row.availability,
    stock: row.stock === null ? null : Number(row.stock),
    pricePerBaseUnit: vigente === null ? null : vigente / packSize,
    minimumQuantity: Number(row.minimum_quantity),
    deliveryDays: row.delivery_days,
    tiers,
  };
}

export const listOfferings = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  const [result, tiers] = await Promise.all([
    query<OfferingRow>(
      `SELECT o.id,c.name,c.brand,c.base_unit,c.category_id,o.description,o.sku,o.pack_size,
              o.price,o.promo_price,o.promo_until,o.availability,o.stock,
              o.minimum_quantity,o.delivery_days
         FROM supplier_offerings o
         JOIN catalog_items c ON c.id=o.catalog_item_id
        WHERE o.company_id=$1 AND o.active=true
        ORDER BY c.name`,
      [user.companyId],
    ),
    query<{ offering_id: string; min_quantity: string; price: string }>(
      `SELECT t.offering_id, t.min_quantity, t.price
         FROM offering_price_tiers t
         JOIN supplier_offerings o ON o.id=t.offering_id
        WHERE o.company_id=$1
        ORDER BY t.min_quantity`,
      [user.companyId],
    ),
  ]);
  return {
    items: result.rows.map((row) =>
      mapOffering(
        row,
        tiers.rows
          .filter((tier) => tier.offering_id === row.id)
          .map((tier) => ({ minQuantity: Number(tier.min_quantity), price: Number(tier.price) })),
      ),
    ),
    limit: planLimits[user.plan].products,
  };
});

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const result = await query<{ id: string; name: string }>(
    "SELECT id,name FROM product_categories ORDER BY sort_order, name",
  );
  return result.rows;
});

const offeringSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(80).optional(),
  baseUnit: z.enum(["kg", "l", "un"]),
  categoryId: z.string().trim().max(40).optional(),
  description: z.string().trim().max(600).optional(),
  sku: z.string().trim().max(80).optional(),
  packSize: z.number().positive().max(1000000),
  price: z.number().min(0).max(9999999).nullable().optional(),
  promoPrice: z.number().min(0).max(9999999).nullable().optional(),
  promoUntil: z.string().trim().max(10).optional(),
  availability: z.enum(["disponivel", "sob_encomenda", "esgotado"]).default("disponivel"),
  stock: z.number().min(0).max(9999999).nullable().optional(),
  minimumQuantity: z.number().positive().max(1000000).default(1),
  deliveryDays: z.number().int().min(0).max(365).nullable().optional(),
  tiers: z
    .array(
      z.object({
        minQuantity: z.number().positive().max(1000000),
        price: z.number().min(0).max(9999999),
      }),
    )
    .max(6)
    .default([]),
});

export const saveOffering = createServerFn({ method: "POST" })
  .validator(offeringSchema)
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    const searchKey = catalogSearchKey(data.name, data.brand);
    if (!searchKey) throw new Error("Informe um nome de produto válido");

    return transaction(async (client) => {
      // O limite do plano vale para o catálogo do fornecedor do mesmo jeito
      // que vale para os produtos do comerciante. Contado dentro da transação
      // e com lock na empresa, para cadastros simultâneos não furarem o teto.
      if (!data.id) {
        const company = await client.query<{ plan: PlanName }>(
          "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
          [user.companyId],
        );
        const count = await client.query<{ total: string }>(
          "SELECT count(*)::text total FROM supplier_offerings WHERE company_id=$1 AND active=true",
          [user.companyId],
        );
        if (Number(count.rows[0].total) >= planLimits[company.rows[0].plan].products)
          throw new Error("Limite de itens do catálogo atingido neste plano");
      }

      // O catálogo canônico se constrói sozinho: reaproveita o item quando ele
      // já existe, cria quando é novo.
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM catalog_items WHERE search_key=$1 AND base_unit=$2",
        [searchKey, data.baseUnit],
      );
      const catalogItemId =
        existing.rows[0]?.id ||
        (
          await client.query<{ id: string }>(
            `INSERT INTO catalog_items (name,brand,base_unit,search_key,category_id)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [data.name, data.brand || null, data.baseUnit, searchKey, data.categoryId || null],
          )
        ).rows[0].id;

      // A categoria pertence ao item do catálogo, que é compartilhado. Se o
      // item ainda não tem categoria, o primeiro fornecedor que informar
      // preenche; quem vier depois não sobrescreve o que já está lá.
      if (data.categoryId)
        await client.query(
          "UPDATE catalog_items SET category_id=$2 WHERE id=$1 AND category_id IS NULL",
          [catalogItemId, data.categoryId],
        );

      const campos = [
        catalogItemId,
        data.description || null,
        data.sku || null,
        data.packSize,
        data.price ?? null,
        data.promoPrice ?? null,
        data.promoUntil || null,
        data.availability,
        data.stock ?? null,
        data.minimumQuantity,
        data.deliveryDays ?? null,
      ];

      let offeringId: string;
      if (data.id) {
        const updated = await client.query<{ id: string }>(
          `UPDATE supplier_offerings
              SET catalog_item_id=$3,description=$4,sku=$5,pack_size=$6,price=$7,
                  promo_price=$8,promo_until=$9,availability=$10,stock=$11,
                  minimum_quantity=$12,delivery_days=$13,updated_at=now()
            WHERE id=$1 AND company_id=$2 AND active=true RETURNING id`,
          [data.id, user.companyId, ...campos],
        );
        if (!updated.rows[0]) throw new Error("Item não encontrado");
        offeringId = updated.rows[0].id;
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO supplier_offerings
             (company_id,catalog_item_id,description,sku,pack_size,price,promo_price,
              promo_until,availability,stock,minimum_quantity,delivery_days)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [user.companyId, ...campos],
        );
        offeringId = created.rows[0].id;
      }

      // As faixas são substituídas por completo: editar uma tabela de preço é
      // mais simples de acertar do que reconciliar linha por linha.
      await client.query("DELETE FROM offering_price_tiers WHERE offering_id=$1", [offeringId]);
      for (const tier of data.tiers) {
        await client.query(
          `INSERT INTO offering_price_tiers (offering_id,min_quantity,price)
           VALUES ($1,$2,$3) ON CONFLICT (offering_id,min_quantity) DO UPDATE SET price=excluded.price`,
          [offeringId, tier.minQuantity, tier.price],
        );
      }
      return { ok: true };
    });
  });

export const removeOffering = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    await query(
      "UPDATE supplier_offerings SET active=false,updated_at=now() WHERE id=$1 AND company_id=$2",
      [data.id, user.companyId],
    );
    return { ok: true };
  });
