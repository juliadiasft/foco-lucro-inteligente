import { createHash } from "node:crypto";

import { brl } from "../format";
import { query } from "./db.server";
import { sendCompanyPush } from "./push.server";

type QuoteRow = {
  product_id: string;
  product_name: string;
  supplier_id: string;
  supplier_name: string;
  price: string;
  minimum_quantity: string;
};

export type SupplierOpportunity = {
  id: string;
  title: string;
  message: string;
  payload: {
    productId: string;
    productName: string;
    bestSupplierId: string;
    bestSupplierName: string;
    bestPrice: number;
    alternativeSupplierId: string;
    alternativeSupplierName: string;
    alternativePrice: number;
    unitSavings: number;
    savingsPercent: number;
    minimumQuantity: number;
    orderSavings: number;
  };
};

export async function createSupplierOpportunity(
  companyId: string,
  productId: string,
): Promise<SupplierOpportunity | null> {
  const result = await query<QuoteRow>(
    `SELECT p.id product_id,p.name product_name,s.id supplier_id,s.name supplier_name,
            sp.price,sp.minimum_quantity
       FROM supplier_prices sp
       JOIN products p ON p.id=sp.product_id AND p.company_id=sp.company_id AND p.active=true
       JOIN suppliers s ON s.id=sp.supplier_id AND s.company_id=sp.company_id AND s.active=true
      WHERE sp.company_id=$1 AND sp.product_id=$2
      ORDER BY sp.price ASC,s.name ASC`,
    [companyId, productId],
  );
  if (result.rows.length < 2) return null;

  const best = result.rows[0];
  const alternative = result.rows[1];
  const bestPrice = Number(best.price);
  const alternativePrice = Number(alternative.price);
  const unitSavings = alternativePrice - bestPrice;
  if (unitSavings <= 0) return null;

  const savingsPercent = (unitSavings / alternativePrice) * 100;
  const minimumQuantity = Math.max(1, Number(best.minimum_quantity));
  const orderSavings = unitSavings * minimumQuantity;
  const signature = [
    productId,
    best.supplier_id,
    bestPrice.toFixed(2),
    alternative.supplier_id,
    alternativePrice.toFixed(2),
  ].join(":");
  const dedupeKey = `supplier:${createHash("sha256").update(signature).digest("hex")}`;
  const title = `${best.supplier_name} está mais barato`;
  const message = `${best.product_name}: economize ${brl(unitSavings)} por unidade (${savingsPercent.toFixed(1)}%) em relação a ${alternative.supplier_name}.`;
  const payload = {
    productId,
    productName: best.product_name,
    bestSupplierId: best.supplier_id,
    bestSupplierName: best.supplier_name,
    bestPrice,
    alternativeSupplierId: alternative.supplier_id,
    alternativeSupplierName: alternative.supplier_name,
    alternativePrice,
    unitSavings,
    savingsPercent,
    minimumQuantity,
    orderSavings,
  };
  const inserted = await query<{ id: string }>(
    `INSERT INTO notifications (company_id,type,title,message,action_url,payload,dedupe_key,expires_at)
     VALUES ($1,'supplier_opportunity',$2,$3,'/fornecedores',$4::jsonb,$5,now()+interval '30 days')
     ON CONFLICT (company_id,dedupe_key) DO NOTHING RETURNING id`,
    [companyId, title, message, JSON.stringify(payload), dedupeKey],
  );
  if (!inserted.rows[0]) return null;

  void sendCompanyPush(companyId, {
    title,
    body: message,
    url: "/fornecedores",
    tag: dedupeKey,
  }).catch((error) => {
    console.error("Falha ao enviar notificação push", error);
  });
  return { id: inserted.rows[0].id, title, message, payload };
}
