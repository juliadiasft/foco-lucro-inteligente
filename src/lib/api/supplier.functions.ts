import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { catalogSearchKey, type BaseUnit } from "../catalog";
import { planLimits, type PlanName } from "../plans";
import { requireActiveSession, requireAdmin, type SessionUser } from "../server/auth.server";
import { query, transaction } from "../server/db.server";

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
    published: boolean;
  }>(
    `SELECT sp.display_name,sp.description,sp.delivery_days,sp.minimum_order,
            sp.public_phone,sp.public_email,sp.published
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
      published: false,
      exists: false,
    };
  return {
    displayName: row.display_name,
    description: row.description,
    deliveryDays: row.delivery_days,
    minimumOrder: row.minimum_order === null ? null : Number(row.minimum_order),
    publicPhone: row.public_phone,
    publicEmail: row.public_email,
    published: row.published,
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
      published: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const user = requireSupplier(await requireActiveSession());
    requireAdmin(user);
    await query(
      `INSERT INTO supplier_profiles
         (company_id,display_name,description,delivery_days,minimum_order,public_phone,public_email,published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (company_id) DO UPDATE SET
         display_name=excluded.display_name,description=excluded.description,
         delivery_days=excluded.delivery_days,minimum_order=excluded.minimum_order,
         public_phone=excluded.public_phone,public_email=excluded.public_email,
         published=excluded.published,updated_at=now()`,
      [
        user.companyId,
        data.displayName,
        data.description || null,
        data.deliveryDays ?? null,
        data.minimumOrder ?? null,
        data.publicPhone || null,
        data.publicEmail || null,
        data.published,
      ],
    );
    return { ok: true };
  });

type OfferingRow = {
  id: string;
  name: string;
  brand: string | null;
  base_unit: BaseUnit;
  description: string | null;
  pack_size: string;
  price: string | null;
  minimum_quantity: string;
  delivery_days: number | null;
};

function mapOffering(row: OfferingRow) {
  const price = row.price === null ? null : Number(row.price);
  const packSize = Number(row.pack_size);
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    baseUnit: row.base_unit,
    description: row.description,
    packSize,
    price,
    pricePerBaseUnit: price === null ? null : price / packSize,
    minimumQuantity: Number(row.minimum_quantity),
    deliveryDays: row.delivery_days,
  };
}

export const listOfferings = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSupplier(await requireActiveSession());
  const result = await query<OfferingRow>(
    `SELECT o.id,c.name,c.brand,c.base_unit,o.description,o.pack_size,o.price,
            o.minimum_quantity,o.delivery_days
       FROM supplier_offerings o
       JOIN catalog_items c ON c.id=o.catalog_item_id
      WHERE o.company_id=$1 AND o.active=true
      ORDER BY c.name`,
    [user.companyId],
  );
  return {
    items: result.rows.map(mapOffering),
    limit: planLimits[user.plan].products,
  };
});

const offeringSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(80).optional(),
  baseUnit: z.enum(["kg", "l", "un"]),
  description: z.string().trim().max(600).optional(),
  packSize: z.number().positive().max(1000000),
  price: z.number().min(0).max(9999999).nullable().optional(),
  minimumQuantity: z.number().positive().max(1000000).default(1),
  deliveryDays: z.number().int().min(0).max(365).nullable().optional(),
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
            `INSERT INTO catalog_items (name,brand,base_unit,search_key)
             VALUES ($1,$2,$3,$4) RETURNING id`,
            [data.name, data.brand || null, data.baseUnit, searchKey],
          )
        ).rows[0].id;

      if (data.id) {
        const updated = await client.query<{ id: string }>(
          `UPDATE supplier_offerings
              SET catalog_item_id=$3,description=$4,pack_size=$5,price=$6,
                  minimum_quantity=$7,delivery_days=$8,updated_at=now()
            WHERE id=$1 AND company_id=$2 AND active=true RETURNING id`,
          [
            data.id,
            user.companyId,
            catalogItemId,
            data.description || null,
            data.packSize,
            data.price ?? null,
            data.minimumQuantity,
            data.deliveryDays ?? null,
          ],
        );
        if (!updated.rows[0]) throw new Error("Item não encontrado");
        return { ok: true };
      }

      await client.query(
        `INSERT INTO supplier_offerings
           (company_id,catalog_item_id,description,pack_size,price,minimum_quantity,delivery_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          user.companyId,
          catalogItemId,
          data.description || null,
          data.packSize,
          data.price ?? null,
          data.minimumQuantity,
          data.deliveryDays ?? null,
        ],
      );
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
