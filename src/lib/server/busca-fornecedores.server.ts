import type { Availability, BaseUnit } from "../catalog";
import type { FiltrosDaBusca } from "../busca-salva";
import { query } from "./db.server";

export type FiltrosDeBusca = FiltrosDaBusca;

export function normalizeTerm(term?: string | null) {
  if (!term) return null;
  const normalized = term
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized || null;
}

export type SearchRow = {
  item_id: string;
  item_name: string;
  brand: string | null;
  base_unit: BaseUnit;
  category_id: string | null;
  offering_id: string;
  pack_size: string;
  price: string | null;
  promo_price: string | null;
  promo_until: Date | null;
  availability: Availability;
  sku: string | null;
  minimum_quantity: string;
  delivery_days: number | null;
  supplier_company_id: string;
  supplier_name: string;
  minimum_order: string | null;
  payment_terms: string | null;
  city: string | null;
  uf: string | null;
  public_phone: string | null;
  public_email: string | null;
};

// A consulta da busca do comerciante, num lugar só: a tela e o aviso "me
// chame quando aparecer um fornecedor" precisam concordar sobre o que é
// "dentro dos filtros". `fornecedorId` restringe a um fornecedor, para o aviso
// checar só quem acabou de mexer na tabela.
export async function consultarOfertas(
  companyId: string,
  f: FiltrosDeBusca,
  fornecedorId: string | null = null,
) {
  const result = await query<SearchRow>(
    `SELECT ci.id item_id, ci.name item_name, ci.brand, ci.base_unit, ci.category_id,
            o.id offering_id, o.pack_size, o.price, o.promo_price, o.promo_until,
            o.availability, o.minimum_quantity, o.sku,
            coalesce(o.delivery_days, sp.delivery_days) delivery_days,
            o.company_id supplier_company_id, sp.display_name supplier_name,
            sp.minimum_order, sp.payment_terms, comp.city, comp.uf,
            sp.public_phone, sp.public_email
       FROM supplier_offerings o
       JOIN catalog_items ci ON ci.id = o.catalog_item_id
       JOIN supplier_profiles sp ON sp.company_id = o.company_id AND sp.published = true
       JOIN companies comp ON comp.id = o.company_id AND comp.account_type = 'fornecedor'
      WHERE o.active = true
          AND ($9::uuid IS NULL OR o.company_id = $9)
        AND ($7::text IS NULL OR ci.category_id = $7)
        AND ($8::boolean = false OR o.availability = 'disponivel')
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
               (CASE WHEN coalesce(
                  CASE WHEN o.promo_price IS NOT NULL
                            AND (o.promo_until IS NULL OR o.promo_until >= current_date)
                       THEN least(o.promo_price, coalesce(o.price, o.promo_price))
                       ELSE o.price END, NULL) IS NULL THEN 1 ELSE 0 END),
               (coalesce(
                  CASE WHEN o.promo_price IS NOT NULL
                            AND (o.promo_until IS NULL OR o.promo_until >= current_date)
                       THEN least(o.promo_price, coalesce(o.price, o.promo_price))
                       ELSE o.price END, 0) / o.pack_size)
      LIMIT 200`,
    [
      companyId,
      f.onlyMySegments,
      normalizeTerm(f.term),
      f.uf,
      f.city,
      f.maxDeliveryDays,
      f.categoryId,
      f.onlyAvailable,
      fornecedorId,
    ],
  );
  return result.rows;
}
