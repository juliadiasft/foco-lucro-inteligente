import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { planLimits } from "../plans";
import { requireActiveSession } from "../server/auth.server";
import { query, transaction } from "../server/db.server";

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(180),
  sku: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).optional(),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0),
  stock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(0),
  unit: z.string().trim().min(1).max(20).default("un"),
});

type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  cost_price: string;
  sale_price: string;
  stock: string;
  minimum_stock: string;
  unit: string;
  active: boolean;
};

export type Product = ReturnType<typeof mapProduct>;

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    costPrice: Number(row.cost_price),
    salePrice: Number(row.sale_price),
    stock: Number(row.stock),
    minimumStock: Number(row.minimum_stock),
    unit: row.unit,
    active: row.active,
  };
}

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const result = await query<ProductRow>(
    "SELECT id, sku, name, description, cost_price, sale_price, stock, minimum_stock, unit, active FROM products WHERE company_id = $1 AND active = true ORDER BY name",
    [user.companyId],
  );
  return result.rows.map(mapProduct);
});

export const saveProduct = createServerFn({ method: "POST" })
  .validator(productSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    if (!data.id) {
      const count = await query<{ count: string }>(
        "SELECT count(*) FROM products WHERE company_id = $1 AND active = true",
        [user.companyId],
      );
      if (Number(count.rows[0].count) >= planLimits[user.plan].products)
        throw new Error("Limite de produtos do plano atingido");
    }
    try {
      if (data.id) {
        const result = await query<ProductRow>(
          `UPDATE products SET name=$3, sku=$4, description=$5, cost_price=$6, sale_price=$7,
             minimum_stock=$8, unit=$9, updated_at=now()
           WHERE id=$1 AND company_id=$2 AND active=true RETURNING *`,
          [
            data.id,
            user.companyId,
            data.name,
            data.sku || null,
            data.description || null,
            data.costPrice,
            data.salePrice,
            data.minimumStock,
            data.unit,
          ],
        );
        if (!result.rows[0]) throw new Error("Produto não encontrado");
        return mapProduct(result.rows[0]);
      }
      return await transaction(async (client) => {
        const result = await client.query<ProductRow>(
          `INSERT INTO products (company_id, name, sku, description, cost_price, sale_price, stock, minimum_stock, unit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            user.companyId,
            data.name,
            data.sku || null,
            data.description || null,
            data.costPrice,
            data.salePrice,
            data.stock,
            data.minimumStock,
            data.unit,
          ],
        );
        if (data.stock > 0) {
          await client.query(
            `INSERT INTO stock_movements (company_id, product_id, movement_type, quantity, unit_cost, note, created_by)
             VALUES ($1,$2,'entry',$3,$4,'Estoque inicial',$5)`,
            [user.companyId, result.rows[0].id, data.stock, data.costPrice, user.id],
          );
        }
        return mapProduct(result.rows[0]);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("Já existe um produto com este SKU");
      throw error;
    }
  });

export const moveStock = createServerFn({ method: "POST" })
  .validator(
    z.object({
      productId: z.string().uuid(),
      mode: z.enum(["entry", "adjustment"]),
      quantity: z.number().min(0),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    return transaction(async (client) => {
      const current = await client.query<ProductRow>(
        "SELECT * FROM products WHERE id=$1 AND company_id=$2 AND active=true FOR UPDATE",
        [data.productId, user.companyId],
      );
      const product = current.rows[0];
      if (!product) throw new Error("Produto não encontrado");
      if (data.mode === "entry" && data.quantity <= 0)
        throw new Error("Informe uma quantidade maior que zero");
      const oldStock = Number(product.stock);
      const newStock = data.mode === "entry" ? oldStock + data.quantity : data.quantity;
      await client.query(
        "UPDATE products SET stock=$3, updated_at=now() WHERE id=$1 AND company_id=$2",
        [data.productId, user.companyId, newStock],
      );
      await client.query(
        `INSERT INTO stock_movements (company_id, product_id, movement_type, quantity, unit_cost, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          user.companyId,
          data.productId,
          data.mode,
          data.mode === "entry" ? data.quantity : newStock - oldStock,
          Number(product.cost_price),
          data.note || (data.mode === "entry" ? "Reposição manual" : "Ajuste de inventário"),
          user.id,
        ],
      );
      return { stock: newStock };
    });
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query(
      "UPDATE products SET active=false, updated_at=now() WHERE id=$1 AND company_id=$2",
      [data.id, user.companyId],
    );
    return { ok: true };
  });
