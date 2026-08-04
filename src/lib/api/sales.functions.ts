import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession } from "../server/auth.server";
import { query, transaction } from "../server/db.server";

const saleSchema = z.object({
  customerName: z.string().trim().max(160).optional(),
  paymentMethod: z.enum(["cash", "pix", "debit", "credit", "boleto", "other"]),
  discount: z.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().positive().max(100000) }))
    .min(1)
    .max(100),
});

export const createSale = createServerFn({ method: "POST" })
  .validator(saleSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const merged = new Map<string, number>();
    for (const item of data.items)
      merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);

    return transaction(async (client) => {
      const ids = [...merged.keys()];
      const result = await client.query<{
        id: string;
        name: string;
        sale_price: string;
        cost_price: string;
        stock: string;
      }>(
        "SELECT id,name,sale_price,cost_price,stock FROM products WHERE company_id=$1 AND active=true AND id=ANY($2::uuid[]) FOR UPDATE",
        [user.companyId, ids],
      );
      if (result.rows.length !== ids.length)
        throw new Error("Um dos produtos não existe ou foi arquivado");

      let subtotal = 0;
      let totalCost = 0;
      for (const product of result.rows) {
        const quantity = merged.get(product.id)!;
        if (Number(product.stock) < quantity)
          throw new Error(`Estoque insuficiente para ${product.name}`);
        subtotal += Number(product.sale_price) * quantity;
        totalCost += Number(product.cost_price) * quantity;
      }
      if (data.discount > subtotal) throw new Error("O desconto não pode ser maior que o subtotal");
      const total = subtotal - data.discount;
      const profit = total - totalCost;
      const sale = await client.query<{ id: string }>(
        `INSERT INTO sales (company_id,customer_name,payment_method,subtotal,discount,total,total_cost,profit,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          user.companyId,
          data.customerName || null,
          data.paymentMethod,
          subtotal,
          data.discount,
          total,
          totalCost,
          profit,
          data.notes || null,
          user.id,
        ],
      );
      const saleId = sale.rows[0].id;
      for (const product of result.rows) {
        const quantity = merged.get(product.id)!;
        const itemSubtotal = Number(product.sale_price) * quantity;
        await client.query(
          `INSERT INTO sale_items (sale_id,product_id,quantity,unit_price,unit_cost,subtotal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            saleId,
            product.id,
            quantity,
            Number(product.sale_price),
            Number(product.cost_price),
            itemSubtotal,
          ],
        );
        await client.query(
          "UPDATE products SET stock=stock-$3, updated_at=now() WHERE id=$1 AND company_id=$2",
          [product.id, user.companyId, quantity],
        );
        await client.query(
          `INSERT INTO stock_movements (company_id,product_id,movement_type,quantity,unit_cost,note,created_by)
           VALUES ($1,$2,'exit',$3,$4,$5,$6)`,
          [
            user.companyId,
            product.id,
            -quantity,
            Number(product.cost_price),
            `Venda ${saleId}`,
            user.id,
          ],
        );
      }
      return { id: saleId, subtotal, discount: data.discount, total, totalCost, profit };
    });
  });

export const listSales = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const result = await query<{
    id: string;
    sold_at: Date;
    customer_name: string | null;
    payment_method: string;
    subtotal: string;
    discount: string;
    total: string;
    total_cost: string;
    profit: string;
    item_count: string;
  }>(
    `SELECT s.id,s.sold_at,s.customer_name,s.payment_method,s.subtotal,s.discount,s.total,s.total_cost,s.profit,
            count(si.id)::text AS item_count
       FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
      WHERE s.company_id=$1 GROUP BY s.id ORDER BY s.sold_at DESC LIMIT 500`,
    [user.companyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    soldAt: row.sold_at.toISOString(),
    customerName: row.customer_name,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    totalCost: Number(row.total_cost),
    profit: Number(row.profit),
    itemCount: Number(row.item_count),
  }));
});
