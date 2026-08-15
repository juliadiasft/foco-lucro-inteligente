import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { effectivePrice, type Availability, type BaseUnit } from "../catalog";
import { requireActiveSession, requireFeature, type SessionUser } from "../server/auth.server";
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
  categoryId: z.string().trim().max(40).optional(),
  onlyAvailable: z.boolean().default(false),
});

type SearchRow = {
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

export const searchSuppliers = createServerFn({ method: "POST" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());
    // Encontrar fornecedor é de todo plano. Comparar preço lado a lado é o
    // que o Essencial sobe de plano para ter.
    requireFeature(user, "comparacaoFornecedores");

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
        user.companyId,
        data.onlyMySegments,
        normalizeTerm(data.term),
        data.uf || null,
        data.city || null,
        data.maxDeliveryDays ?? null,
        data.categoryId || null,
        data.onlyAvailable,
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
          promoPrice: number | null;
          emPromocao: boolean;
          availability: Availability;
          sku: string | null;
          paymentTerms: string | null;
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
      const tabela = row.price === null ? null : Number(row.price);
      const promo = row.promo_price === null ? null : Number(row.promo_price);
      const promoUntil = row.promo_until ? row.promo_until.toISOString().slice(0, 10) : null;
      // O preço que vale na comparação é o promocional, quando está no prazo.
      const price = effectivePrice(tabela, promo, promoUntil);
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
        promoPrice: promo,
        emPromocao: promo !== null && price === promo && tabela !== null && promo < tabela,
        availability: row.availability,
        sku: row.sku,
        paymentTerms: row.payment_terms,
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

// Diretório de fornecedores da Central. É o que faz a tela de Fornecedores
// deixar de pedir cadastro manual: quem publicou vitrine aparece sozinho para
// os comerciantes do nicho.
export const listSupplierDirectory = createServerFn({ method: "POST" })
  .validator(
    z.object({
      search: z.string().trim().max(120).optional(),
      onlyMySegments: z.boolean().default(true),
      uf: z.string().trim().length(2).toUpperCase().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());
    const result = await query<{
      company_id: string;
      name: string;
      description: string | null;
      city: string | null;
      uf: string | null;
      delivery_days: number | null;
      minimum_order: string | null;
      public_phone: string | null;
      public_email: string | null;
      itens: string;
      nichos: string | null;
      na_agenda: boolean;
    }>(
      `SELECT c.id company_id,
              coalesce(sp.display_name, c.name) name,
              sp.description, c.city, c.uf, sp.delivery_days, sp.minimum_order,
              sp.public_phone, sp.public_email,
              (SELECT count(*) FROM supplier_offerings o
                WHERE o.company_id=c.id AND o.active=true)::text itens,
              (SELECT string_agg(sg.name, ', ' ORDER BY sg.sort_order)
                 FROM company_segments cs JOIN segments sg ON sg.id=cs.segment_id
                WHERE cs.company_id=c.id) nichos,
              EXISTS (SELECT 1 FROM suppliers s
                       WHERE s.company_id=$1 AND s.supplier_company_id=c.id
                         AND s.active=true) na_agenda
         FROM companies c
         JOIN supplier_profiles sp ON sp.company_id=c.id AND sp.published=true
        WHERE c.account_type='fornecedor'
          AND ($2::boolean = false OR EXISTS (
                SELECT 1 FROM company_segments f
                 WHERE f.company_id=c.id
                   AND f.segment_id IN (
                         SELECT segment_id FROM company_segments WHERE company_id=$1)))
          AND ($3::text IS NULL OR coalesce(sp.display_name, c.name) ILIKE '%' || $3 || '%')
          AND ($4::text IS NULL OR c.uf = $4)
        ORDER BY (SELECT count(*) FROM supplier_offerings o
                   WHERE o.company_id=c.id AND o.active=true) DESC,
                 coalesce(sp.display_name, c.name)
        LIMIT 100`,
      [user.companyId, data.onlyMySegments, data.search || null, data.uf || null],
    );
    return result.rows.map((row) => ({
      companyId: row.company_id,
      name: row.name,
      description: row.description,
      city: row.city,
      uf: row.uf,
      deliveryDays: row.delivery_days,
      minimumOrder: row.minimum_order === null ? null : Number(row.minimum_order),
      publicPhone: row.public_phone,
      publicEmail: row.public_email,
      itens: Number(row.itens),
      nichos: row.nichos,
      naAgenda: row.na_agenda,
    }));
  });

export const addSupplierFromDirectory = createServerFn({ method: "POST" })
  .validator(z.object({ supplierCompanyId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());
    const supplier = await query<{
      name: string;
      phone: string | null;
      email: string | null;
      delivery_days: number | null;
    }>(
      `SELECT coalesce(sp.display_name, c.name) name, sp.public_phone phone,
              sp.public_email email, sp.delivery_days
         FROM companies c
         JOIN supplier_profiles sp ON sp.company_id=c.id AND sp.published=true
        WHERE c.id=$1 AND c.account_type='fornecedor'`,
      [data.supplierCompanyId],
    );
    const row = supplier.rows[0];
    if (!row) throw new Error("Fornecedor não encontrado");

    // Os dados vêm da vitrine, não do formulário: o comerciante não redigita
    // nada para começar a trabalhar com um fornecedor da Central.
    await query(
      `INSERT INTO suppliers (company_id,name,phone,email,delivery_days,supplier_company_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_id,supplier_company_id) WHERE supplier_company_id IS NOT NULL
       DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email,
                     active=true,updated_at=now()`,
      [
        user.companyId,
        row.name,
        row.phone,
        row.email,
        row.delivery_days ?? 0,
        data.supplierCompanyId,
      ],
    );
    return { ok: true };
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
