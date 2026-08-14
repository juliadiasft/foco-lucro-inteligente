import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { BaseUnit } from "../catalog";
import { requireActiveSession, type SessionUser } from "../server/auth.server";
import { query } from "../server/db.server";

// Busca é do comerciante. O fornecedor não pesquisa concorrente por aqui, e
// em nenhum momento ele fica sabendo quem procurou por ele.
function requireMerchant(user: SessionUser) {
  if (user.accountType !== "comerciante") throw new Error("Área exclusiva de comerciantes");
  return user;
}

const searchSchema = z.object({
  term: z.string().trim().max(120).optional(),
  onlyMySegments: z.boolean().default(true),
  uf: z.string().trim().length(2).toUpperCase().optional(),
  city: z.string().trim().max(120).optional(),
  maxDeliveryDays: z.number().int().min(0).max(365).nullable().optional(),
});

type SearchRow = {
  item_id: string;
  item_name: string;
  brand: string | null;
  base_unit: BaseUnit;
  offering_id: string;
  pack_size: string;
  price: string | null;
  minimum_quantity: string;
  delivery_days: number | null;
  supplier_company_id: string;
  supplier_name: string;
  minimum_order: string | null;
  city: string | null;
  uf: string | null;
  public_phone: string | null;
  public_email: string | null;
};

export const searchSuppliers = createServerFn({ method: "POST" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());

    const result = await query<SearchRow>(
      `SELECT ci.id item_id, ci.name item_name, ci.brand, ci.base_unit,
              o.id offering_id, o.pack_size, o.price, o.minimum_quantity,
              coalesce(o.delivery_days, sp.delivery_days) delivery_days,
              o.company_id supplier_company_id, sp.display_name supplier_name,
              sp.minimum_order, comp.city, comp.uf, sp.public_phone, sp.public_email
         FROM supplier_offerings o
         JOIN catalog_items ci ON ci.id = o.catalog_item_id
         JOIN supplier_profiles sp ON sp.company_id = o.company_id AND sp.published = true
         JOIN companies comp ON comp.id = o.company_id AND comp.account_type = 'fornecedor'
        WHERE o.active = true
          AND ($2::boolean = false OR EXISTS (
                SELECT 1 FROM company_segments fornecedor
                 WHERE fornecedor.company_id = o.company_id
                   AND fornecedor.segment_id IN (
                         SELECT segment_id FROM company_segments WHERE company_id = $1)))
          AND ($3::text IS NULL OR ci.search_key LIKE '%' || $3 || '%')
          AND ($4::text IS NULL OR comp.uf = $4)
          AND ($5::text IS NULL OR lower(comp.city) = lower($5))
          AND ($6::int IS NULL OR coalesce(o.delivery_days, sp.delivery_days) IS NULL
               OR coalesce(o.delivery_days, sp.delivery_days) <= $6)
        ORDER BY ci.name,
                 (CASE WHEN o.price IS NULL THEN 1 ELSE 0 END),
                 (o.price / o.pack_size)
        LIMIT 200`,
      [
        user.companyId,
        data.onlyMySegments,
        normalizeTerm(data.term),
        data.uf || null,
        data.city || null,
        data.maxDeliveryDays ?? null,
      ],
    );

    // Agrupa por produto: a comparação só faz sentido entre ofertas do mesmo
    // item, e o preço por unidade base é o que coloca embalagens diferentes
    // no mesmo pé de igualdade.
    const groups = new Map<
      string,
      {
        itemId: string;
        name: string;
        brand: string | null;
        baseUnit: BaseUnit;
        offers: Array<{
          offeringId: string;
          supplierCompanyId: string;
          supplierName: string;
          city: string | null;
          uf: string | null;
          packSize: number;
          price: number | null;
          pricePerBaseUnit: number | null;
          minimumQuantity: number;
          minimumOrder: number | null;
          deliveryDays: number | null;
          publicPhone: string | null;
          publicEmail: string | null;
        }>;
      }
    >();

    for (const row of result.rows) {
      const price = row.price === null ? null : Number(row.price);
      const packSize = Number(row.pack_size);
      const group = groups.get(row.item_id) || {
        itemId: row.item_id,
        name: row.item_name,
        brand: row.brand,
        baseUnit: row.base_unit,
        offers: [],
      };
      group.offers.push({
        offeringId: row.offering_id,
        supplierCompanyId: row.supplier_company_id,
        supplierName: row.supplier_name,
        city: row.city,
        uf: row.uf,
        packSize,
        price,
        pricePerBaseUnit: price === null ? null : price / packSize,
        minimumQuantity: Number(row.minimum_quantity),
        minimumOrder: row.minimum_order === null ? null : Number(row.minimum_order),
        deliveryDays: row.delivery_days,
        publicPhone: row.public_phone,
        publicEmail: row.public_email,
      });
      groups.set(row.item_id, group);
    }

    return [...groups.values()].map((group) => {
      const withPrice = group.offers.filter((offer) => offer.pricePerBaseUnit !== null);
      const best = withPrice[0] ?? null;
      const runnerUp = withPrice[1] ?? null;
      // Economia só existe quando há com o que comparar. Com uma oferta só,
      // não há diferença a mostrar.
      const savingsPerBaseUnit =
        best && runnerUp
          ? (runnerUp.pricePerBaseUnit as number) - (best.pricePerBaseUnit as number)
          : null;
      return {
        ...group,
        offerCount: group.offers.length,
        savingsPerBaseUnit,
        savingsPercent:
          savingsPerBaseUnit && runnerUp
            ? (savingsPerBaseUnit / (runnerUp.pricePerBaseUnit as number)) * 100
            : null,
      };
    });
  });

function normalizeTerm(term?: string) {
  if (!term) return null;
  const normalized = term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized || null;
}
