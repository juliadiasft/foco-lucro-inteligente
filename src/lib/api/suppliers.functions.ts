import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(180),
  cnpj: z.string().trim().max(24).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
  deliveryDays: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

type SupplierRow = {
  id: string;
  name: string;
  cnpj: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  delivery_days: number | null;
  notes: string | null;
  active: boolean;
};

function mapSupplier(row: SupplierRow) {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    deliveryDays: row.delivery_days,
    notes: row.notes,
    active: row.active,
  };
}

export const listSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const result = await query<SupplierRow>(
    "SELECT * FROM suppliers WHERE company_id=$1 AND active=true ORDER BY name",
    [user.companyId],
  );
  return result.rows.map(mapSupplier);
});

export const saveSupplier = createServerFn({ method: "POST" })
  .validator(supplierSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const values = [
      data.name,
      data.cnpj || null,
      data.contactName || null,
      data.phone || null,
      data.email || null,
      data.deliveryDays ?? null,
      data.notes || null,
    ];
    const result = data.id
      ? await query<SupplierRow>(
          `UPDATE suppliers SET name=$3, cnpj=$4, contact_name=$5, phone=$6, email=$7, delivery_days=$8, notes=$9, updated_at=now()
           WHERE id=$1 AND company_id=$2 AND active=true RETURNING *`,
          [data.id, user.companyId, ...values],
        )
      : await query<SupplierRow>(
          `INSERT INTO suppliers (company_id,name,cnpj,contact_name,phone,email,delivery_days,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [user.companyId, ...values],
        );
    if (!result.rows[0]) throw new Error("Fornecedor não encontrado");
    return mapSupplier(result.rows[0]);
  });

export const archiveSupplier = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query(
      "UPDATE suppliers SET active=false, updated_at=now() WHERE id=$1 AND company_id=$2",
      [data.id, user.companyId],
    );
    return { ok: true };
  });

export const listSupplierPrices = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const result = await query<{
    id: string;
    supplier_id: string;
    supplier_name: string;
    product_id: string;
    product_name: string;
    price: string;
    minimum_quantity: string;
    notes: string | null;
    quoted_at: Date;
    rank: string;
  }>(
    `SELECT sp.id, sp.supplier_id, s.name AS supplier_name, sp.product_id, p.name AS product_name,
            sp.price, sp.minimum_quantity, sp.notes, sp.quoted_at,
            dense_rank() OVER (PARTITION BY sp.product_id ORDER BY sp.price ASC)::text AS rank
       FROM supplier_prices sp
       JOIN suppliers s ON s.id=sp.supplier_id AND s.company_id=sp.company_id AND s.active=true
       JOIN products p ON p.id=sp.product_id AND p.company_id=sp.company_id AND p.active=true
      WHERE sp.company_id=$1
      ORDER BY p.name, sp.price, s.name`,
    [user.companyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    productId: row.product_id,
    productName: row.product_name,
    price: Number(row.price),
    minimumQuantity: Number(row.minimum_quantity),
    notes: row.notes,
    quotedAt: row.quoted_at.toISOString(),
    rank: Number(row.rank),
  }));
});

export const saveSupplierPrice = createServerFn({ method: "POST" })
  .validator(
    z.object({
      supplierId: z.string().uuid(),
      productId: z.string().uuid(),
      price: z.number().min(0),
      minimumQuantity: z.number().positive().default(1),
      notes: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const allowed = await query<{ ok: boolean }>(
      `SELECT true AS ok FROM suppliers s, products p
       WHERE s.id=$1 AND p.id=$2 AND s.company_id=$3 AND p.company_id=$3 AND s.active=true AND p.active=true`,
      [data.supplierId, data.productId, user.companyId],
    );
    if (!allowed.rows[0]) throw new Error("Produto ou fornecedor não encontrado");
    await query(
      `INSERT INTO supplier_prices (company_id,supplier_id,product_id,price,minimum_quantity,notes,quoted_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (supplier_id,product_id) DO UPDATE SET price=excluded.price, minimum_quantity=excluded.minimum_quantity,
         notes=excluded.notes, quoted_at=now(), updated_at=now()`,
      [
        user.companyId,
        data.supplierId,
        data.productId,
        data.price,
        data.minimumQuantity,
        data.notes || null,
      ],
    );
    return { ok: true };
  });

export const deleteSupplierPrice = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query("DELETE FROM supplier_prices WHERE id=$1 AND company_id=$2", [
      data.id,
      user.companyId,
    ]);
    return { ok: true };
  });
