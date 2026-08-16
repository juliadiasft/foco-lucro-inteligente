import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { effectivePrice, tierPriceFor, type BaseUnit } from "../catalog";
import { requireActiveSession } from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { sendCompanyPush } from "../server/push.server";
import { createOrderFinanceEntries } from "./finance.functions";

export type OrderStatus = "enviado" | "aceito" | "recusado" | "concluido" | "cancelado";

export const orderStatusLabels: Record<OrderStatus, string> = {
  enviado: "Aguardando o fornecedor",
  aceito: "Aceito",
  recusado: "Recusado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// Quem pode mover o pedido para cada situação. O comerciante desiste, o
// fornecedor aceita, recusa e conclui — ninguém decide pelo outro lado.
const allowedTransitions: Record<
  OrderStatus,
  { from: OrderStatus[]; by: "comerciante" | "fornecedor" }
> = {
  aceito: { from: ["enviado"], by: "fornecedor" },
  recusado: { from: ["enviado"], by: "fornecedor" },
  concluido: { from: ["aceito"], by: "fornecedor" },
  cancelado: { from: ["enviado", "aceito"], by: "comerciante" },
  enviado: { from: [], by: "comerciante" },
};

export const createOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      offeringId: z.string().uuid(),
      quantity: z.number().positive().max(100000),
      note: z.string().trim().max(600).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    if (user.accountType !== "comerciante")
      throw new Error("Apenas o comerciante pode fazer pedidos");

    const orderId = await transaction(async (client) => {
      const offering = await client.query<{
        id: string;
        company_id: string;
        name: string;
        brand: string | null;
        base_unit: BaseUnit;
        pack_size: string;
        price: string | null;
        promo_price: string | null;
        promo_until: Date | null;
        availability: string;
        minimum_quantity: string;
        minimum_order: string | null;
      }>(
        `SELECT o.id,o.company_id,ci.name,ci.brand,ci.base_unit,o.pack_size,o.price,
                o.promo_price,o.promo_until,o.availability,o.minimum_quantity,sp.minimum_order
           FROM supplier_offerings o
           JOIN catalog_items ci ON ci.id=o.catalog_item_id
           JOIN supplier_profiles sp ON sp.company_id=o.company_id AND sp.published=true
          WHERE o.id=$1 AND o.active=true`,
        [data.offeringId],
      );
      const row = offering.rows[0];
      if (!row) throw new Error("Item não está mais disponível");
      if (row.availability === "esgotado")
        throw new Error("Este item está esgotado. Fale com o fornecedor pela conversa.");

      // O preço cobrado tem de ser o mesmo que apareceu na comparação: preço
      // promocional quando a promoção está no prazo, e faixa de quantidade
      // quando o pedido alcança o mínimo dela. Cobrar o preço de tabela depois
      // de anunciar promoção seria mostrar um valor e cobrar outro.
      const tiers = await client.query<{ min_quantity: string; price: string }>(
        "SELECT min_quantity,price FROM offering_price_tiers WHERE offering_id=$1",
        [row.id],
      );
      const vigente = effectivePrice(
        row.price === null ? null : Number(row.price),
        row.promo_price === null ? null : Number(row.promo_price),
        row.promo_until ? row.promo_until.toISOString().slice(0, 10) : null,
      );
      if (vigente === null)
        throw new Error("Este item é sob consulta. Fale com o fornecedor pela conversa.");

      const minimumQuantity = Number(row.minimum_quantity);
      if (data.quantity < minimumQuantity)
        throw new Error(`A quantidade mínima deste item é ${minimumQuantity}`);

      const daFaixa = tierPriceFor(
        tiers.rows.map((tier) => ({
          minQuantity: Number(tier.min_quantity),
          price: Number(tier.price),
        })),
        data.quantity,
      );
      // Vale sempre o menor entre o preço vigente e o da faixa alcançada.
      const unitPrice = daFaixa === null ? vigente : Math.min(vigente, daFaixa);
      const subtotal = unitPrice * data.quantity;
      const minimumOrder = row.minimum_order === null ? null : Number(row.minimum_order);
      if (minimumOrder !== null && subtotal < minimumOrder)
        throw new Error(
          `O pedido mínimo deste fornecedor é de R$ ${minimumOrder.toFixed(2).replace(".", ",")}`,
        );

      const order = await client.query<{ id: string }>(
        `INSERT INTO purchase_orders (merchant_company_id,supplier_company_id,total,note,created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [user.companyId, row.company_id, subtotal, data.note || null, user.id],
      );
      await client.query(
        `INSERT INTO purchase_order_items
           (order_id,offering_id,item_name,brand,base_unit,pack_size,quantity,unit_price,subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          order.rows[0].id,
          row.id,
          row.name,
          row.brand,
          row.base_unit,
          Number(row.pack_size),
          data.quantity,
          unitPrice,
          subtotal,
        ],
      );
      return { id: order.rows[0].id, supplierCompanyId: row.company_id };
    });

    void sendCompanyPush(orderId.supplierCompanyId, {
      title: `Novo pedido de ${user.companyName}`,
      body: "Abra a Central para aceitar ou recusar.",
      url: "/fornecedor/pedidos",
      tag: `pedido:${orderId.id}`,
    }).catch((error) => console.error("Falha ao notificar pedido", error));

    return { id: orderId.id };
  });

type OrderRow = {
  id: string;
  status: OrderStatus;
  total: string;
  note: string | null;
  created_at: Date;
  counterpart_name: string;
  city: string | null;
  uf: string | null;
  item_name: string;
  brand: string | null;
  base_unit: BaseUnit;
  pack_size: string;
  quantity: string;
  unit_price: string;
};

export const listOrders = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const isMerchant = user.accountType === "comerciante";
  const result = await query<OrderRow>(
    `SELECT o.id,o.status,o.total,o.note,o.created_at,
            coalesce(sp.display_name, other.name) counterpart_name, other.city, other.uf,
            i.item_name,i.brand,i.base_unit,i.pack_size,i.quantity,i.unit_price
       FROM purchase_orders o
       JOIN companies other
         ON other.id = CASE WHEN $2::boolean THEN o.supplier_company_id
                            ELSE o.merchant_company_id END
       LEFT JOIN supplier_profiles sp ON sp.company_id = other.id
       JOIN purchase_order_items i ON i.order_id = o.id
      WHERE ($2::boolean AND o.merchant_company_id=$1)
         OR (NOT $2::boolean AND o.supplier_company_id=$1)
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [user.companyId, isMerchant],
  );
  return {
    side: isMerchant ? ("comerciante" as const) : ("fornecedor" as const),
    orders: result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      total: Number(row.total),
      note: row.note,
      createdAt: row.created_at.toISOString(),
      counterpartName: row.counterpart_name,
      city: row.city,
      uf: row.uf,
      itemName: row.item_name,
      brand: row.brand,
      baseUnit: row.base_unit,
      packSize: Number(row.pack_size),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    })),
  };
});

export const updateOrderStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["aceito", "recusado", "concluido", "cancelado"]),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const rule = allowedTransitions[data.status];
    if (user.accountType !== rule.by) throw new Error("Você não pode alterar este pedido");

    const column = rule.by === "comerciante" ? "merchant_company_id" : "supplier_company_id";
    const updated = await transaction(async (client) => {
      const result = await client.query<{ id: string; merchant_company_id: string }>(
        `UPDATE purchase_orders SET status=$3,updated_at=now()
          WHERE id=$1 AND ${column}=$2 AND status = ANY($4::text[])
          RETURNING id, merchant_company_id`,
        [data.id, user.companyId, data.status, rule.from],
      );
      // Pedido aceito é dinheiro combinado: vira conta a pagar para quem
      // compra e conta a receber para quem vende, na mesma transação.
      if (result.rows[0] && data.status === "aceito")
        await createOrderFinanceEntries(client, data.id);
      return result;
    });
    if (!updated.rows[0]) throw new Error("Não é possível mudar este pedido agora");

    if (rule.by === "fornecedor")
      void sendCompanyPush(updated.rows[0].merchant_company_id, {
        title: `Pedido ${orderStatusLabels[data.status].toLowerCase()}`,
        body: `${user.companyName} atualizou seu pedido.`,
        url: "/pedidos",
        tag: `pedido:${data.id}`,
      }).catch((error) => console.error("Falha ao notificar pedido", error));

    return { ok: true };
  });
