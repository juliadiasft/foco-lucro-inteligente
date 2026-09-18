import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { effectivePrice, type Availability, type BaseUnit } from "../catalog";
import { dataDoBanco } from "../fornecedor-sinais";
import { requireActiveSession, requireFeature, type SessionUser } from "../server/auth.server";
import { query } from "../server/db.server";
import { chaveDaBusca, type FiltrosDaBusca } from "../busca-salva";
import { consultarOfertas, normalizeTerm } from "../server/busca-fornecedores.server";
import { consumeRateLimit } from "../server/rate-limit.server";

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
  // Buscas de conferência (X04: "e se eu soltasse este filtro?") não são o
  // comerciante procurando, e não podem entrar na contagem do fornecedor.
  semRegistro: z.boolean().default(false),
});

export const searchSuppliers = createServerFn({ method: "POST" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());
    // Encontrar fornecedor é de todo plano. Comparar preço lado a lado é o
    // que o Essencial sobe de plano para ter.
    requireFeature(user, "comparacaoFornecedores");

    const rows = await consultarOfertas(user.companyId, {
      term: normalizeTerm(data.term) ?? null,
      onlyMySegments: data.onlyMySegments,
      uf: data.uf || null,
      city: data.city || null,
      maxDeliveryDays: data.maxDeliveryDays ?? null,
      categoryId: data.categoryId || null,
      onlyAvailable: data.onlyAvailable,
    });

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

    for (const row of rows) {
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

    // Grava a busca. É o que permite dizer ao fornecedor "14 buscas na sua
    // região esta semana, você não apareceu em nenhuma" — o gancho que
    // transforma montar catálogo de tarefa chata em dinheiro na mesa.
    //
    // Não espera o await: o comerciante não pode ficar olhando a tela girar
    // por causa de uma estatística. E falhar aqui não pode derrubar a busca —
    // perder uma linha de analytics é barato, perder a busca não é.
    // A cidade sai da própria empresa no mesmo INSERT: a sessão não carrega
    // cidade, e uma consulta extra a cada busca não se justifica por isto.
    if (!data.semRegistro)
      void query(
        `INSERT INTO buscas_do_comerciante (company_id,termo,categoria_id,cidade,uf,resultados)
       SELECT c.id,$2,$3,c.city,c.uf,$4 FROM companies c WHERE c.id=$1`,
        [user.companyId, normalizeTerm(data.term) ?? "", data.categoryId || null, rows.length],
      ).catch((erro) => console.error("Falha ao registrar busca do comerciante", erro));

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
      concluidos: string;
      respondidos: string;
      recebidos: string;
      nota: string | null;
      avaliacoes: string;
      aberta_em: Date | string | null;
    }>(
      `SELECT c.id company_id,
              coalesce(sp.display_name, c.name) name,
              sp.description, c.city, c.uf, sp.delivery_days, sp.minimum_order,
              sp.public_phone, sp.public_email,
              c.receita_aberta_em aberta_em,
              (SELECT count(*) FROM supplier_offerings o
                WHERE o.company_id=c.id AND o.active=true)::text itens,
              (SELECT string_agg(sg.name, ', ' ORDER BY sg.sort_order)
                 FROM company_segments cs JOIN segments sg ON sg.id=cs.segment_id
                WHERE cs.company_id=c.id) nichos,
              EXISTS (SELECT 1 FROM suppliers s
                       WHERE s.company_id=$1 AND s.supplier_company_id=c.id
                         AND s.active=true) na_agenda,
              -- Sinais de confianca: os dois primeiros funcionam desde o
              -- primeiro dia, sem depender de ninguem ter avaliado.
              (SELECT count(*) FROM purchase_orders po
                WHERE po.supplier_company_id=c.id AND po.status='concluido')::text concluidos,
              (SELECT count(*) FROM quote_requests q
                WHERE q.supplier_company_id=c.id AND q.status <> 'aberto')::text respondidos,
              (SELECT count(*) FROM quote_requests q
                WHERE q.supplier_company_id=c.id)::text recebidos,
              (SELECT avg(rating)::text FROM reviews r WHERE r.subject_company_id=c.id) nota,
              (SELECT count(*) FROM reviews r WHERE r.subject_company_id=c.id)::text avaliacoes
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
      pedidosConcluidos: Number(row.concluidos),
      taxaResposta:
        Number(row.recebidos) > 0 ? (Number(row.respondidos) / Number(row.recebidos)) * 100 : null,
      nota: row.nota === null ? null : Number(row.nota),
      avaliacoes: Number(row.avaliacoes),
      abertaEm: dataDoBanco(row.aberta_em),
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

// Quando a busca nao devolve nada, o comerciante conta de quem compra hoje.
// Para ele, a tela deixa de ser um beco sem saida. Para nos, cada indicacao
// e um fornecedor com demanda ja comprovada — que e o argumento que abre a
// conversa com esse fornecedor depois.
export const reportSupplierLead = createServerFn({ method: "POST" })
  .validator(
    z.object({
      supplierName: z.string().trim().min(2).max(160),
      city: z.string().trim().max(120).optional(),
      uf: z.string().trim().length(2).toUpperCase().optional(),
      products: z.string().trim().max(300).optional(),
      searchTerm: z.string().trim().max(120).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());

    // Sem limite, um formulario aberto vira porta de spam e enche o banco.
    const allowed = await consumeRateLimit(
      `indicacao:${user.companyId}`,
      user.id,
      20,
      24 * 60 * 60,
    );
    if (!allowed) throw new Error("Muitas indicações hoje. Tente novamente amanhã.");

    const supplierKey = normalizeTerm(data.supplierName);
    if (!supplierKey) throw new Error("Informe o nome do fornecedor");

    // Cidade e UF caem para as da propria empresa quando o comerciante nao
    // preenche: o fornecedor dele quase sempre atende a regiao dele.
    await query(
      `INSERT INTO supplier_leads
         (company_id,supplier_name,supplier_key,city,uf,products,search_term)
       SELECT $1,$2,$3,coalesce($4,c.city),coalesce($5,c.uf),$6,$7
         FROM companies c WHERE c.id=$1
       ON CONFLICT (company_id,supplier_key) DO UPDATE SET
         supplier_name=excluded.supplier_name,
         city=coalesce(excluded.city,supplier_leads.city),
         uf=coalesce(excluded.uf,supplier_leads.uf),
         products=coalesce(excluded.products,supplier_leads.products)`,
      [
        user.companyId,
        data.supplierName,
        supplierKey,
        data.city || null,
        data.uf || null,
        data.products || null,
        normalizeTerm(data.searchTerm),
      ],
    );

    return { ok: true };
  });

// "Avisar se aparecer um fornecedor dentro dos filtros" (X04).
const buscaSalvaSchema = z.object({
  term: z.string().trim().max(120).optional(),
  onlyMySegments: z.boolean().default(true),
  uf: z.string().trim().length(2).toUpperCase().optional(),
  city: z.string().trim().max(120).optional(),
  maxDeliveryDays: z.number().int().min(0).max(365).nullable().optional(),
  categoryId: z.string().trim().max(40).optional(),
  onlyAvailable: z.boolean().default(false),
});

const LIMITE_DE_BUSCAS_SALVAS = 10;

const filtrosDe = (data: z.infer<typeof buscaSalvaSchema>): FiltrosDaBusca => ({
  term: data.term?.trim() || null,
  onlyMySegments: data.onlyMySegments,
  uf: data.uf || null,
  city: data.city?.trim() || null,
  maxDeliveryDays: data.maxDeliveryDays ?? null,
  categoryId: data.categoryId || null,
  onlyAvailable: data.onlyAvailable,
});

export const getBuscaSalva = createServerFn({ method: "POST" })
  .validator(buscaSalvaSchema)
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());
    const achou = await query("SELECT 1 FROM buscas_salvas WHERE company_id=$1 AND chave=$2", [
      user.companyId,
      chaveDaBusca(filtrosDe(data)),
    ]);
    return { ativa: achou.rows.length > 0 };
  });

export const setBuscaSalva = createServerFn({ method: "POST" })
  .validator(buscaSalvaSchema.extend({ ativa: z.boolean() }))
  .handler(async ({ data }) => {
    const user = requireMerchant(await requireActiveSession());
    const filtros = filtrosDe(data);
    const chave = chaveDaBusca(filtros);
    if (!data.ativa) {
      await query("DELETE FROM buscas_salvas WHERE company_id=$1 AND chave=$2", [
        user.companyId,
        chave,
      ]);
      return { ativa: false };
    }
    const total = await query<{ n: string }>(
      "SELECT count(*)::text n FROM buscas_salvas WHERE company_id=$1 AND chave<>$2",
      [user.companyId, chave],
    );
    if (Number(total.rows[0].n) >= LIMITE_DE_BUSCAS_SALVAS)
      throw new Error(
        `Você já guarda ${LIMITE_DE_BUSCAS_SALVAS} avisos de busca. Desligue um para criar outro.`,
      );
    // Quem já cabe hoje não vira aviso: o aviso é para quem chegar depois.
    const hoje = await consultarOfertas(user.companyId, filtros);
    const vistos = [...new Set(hoje.map((r) => r.supplier_company_id))];
    await query(
      `INSERT INTO buscas_salvas (company_id,chave,term,only_my_segments,uf,city,
                                  max_delivery_days,category_id,only_available,fornecedores_vistos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid[])
       ON CONFLICT (company_id,chave) DO NOTHING`,
      [
        user.companyId,
        chave,
        filtros.term,
        filtros.onlyMySegments,
        filtros.uf,
        filtros.city,
        filtros.maxDeliveryDays,
        filtros.categoryId,
        filtros.onlyAvailable,
        vistos,
      ],
    );
    return { ativa: true };
  });
