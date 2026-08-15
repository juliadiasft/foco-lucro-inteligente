import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

export const saveReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      orderId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    // Só quem participou de um pedido concluído avalia, e apenas a outra
    // parte. É o que separa avaliação de mural de recado.
    const order = await query<{ merchant_company_id: string; supplier_company_id: string }>(
      `SELECT merchant_company_id, supplier_company_id FROM purchase_orders
        WHERE id=$1 AND status='concluido'
          AND (merchant_company_id=$2 OR supplier_company_id=$2)`,
      [data.orderId, user.companyId],
    );
    const row = order.rows[0];
    if (!row) throw new Error("Você só pode avaliar um pedido concluído do qual participou");

    const subject =
      row.merchant_company_id === user.companyId
        ? row.supplier_company_id
        : row.merchant_company_id;

    await query(
      `INSERT INTO reviews (order_id,author_company_id,subject_company_id,rating,comment,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (order_id, author_company_id)
       DO UPDATE SET rating=excluded.rating, comment=excluded.comment`,
      [data.orderId, user.companyId, subject, data.rating, data.comment || null, user.id],
    );
    return { ok: true };
  });

export const listPendingReviews = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const isMerchant = user.accountType === "comerciante";
  const result = await query<{
    order_id: string;
    counterpart_name: string;
    total: string;
    concluded_at: Date;
    my_rating: number | null;
    my_comment: string | null;
  }>(
    `SELECT o.id order_id,
            coalesce(sp.display_name, other.name) counterpart_name,
            o.total, o.updated_at concluded_at,
            r.rating my_rating, r.comment my_comment
       FROM purchase_orders o
       JOIN companies other
         ON other.id = CASE WHEN $2::boolean THEN o.supplier_company_id
                            ELSE o.merchant_company_id END
       LEFT JOIN supplier_profiles sp ON sp.company_id = other.id
       LEFT JOIN reviews r ON r.order_id = o.id AND r.author_company_id = $1
      WHERE o.status='concluido'
        AND (($2::boolean AND o.merchant_company_id=$1)
             OR (NOT $2::boolean AND o.supplier_company_id=$1))
      ORDER BY o.updated_at DESC
      LIMIT 50`,
    [user.companyId, isMerchant],
  );
  return result.rows.map((row) => ({
    orderId: row.order_id,
    counterpartName: row.counterpart_name,
    total: Number(row.total),
    concludedAt: row.concluded_at.toISOString(),
    myRating: row.my_rating,
    myComment: row.my_comment,
  }));
});

export const listReceivedReviews = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const [reviews, resumo] = await Promise.all([
    query<{ rating: number; comment: string | null; created_at: Date; autor: string }>(
      `SELECT r.rating, r.comment, r.created_at, a.name autor
         FROM reviews r JOIN companies a ON a.id = r.author_company_id
        WHERE r.subject_company_id=$1
        ORDER BY r.created_at DESC LIMIT 50`,
      [user.companyId],
    ),
    query<{ media: string | null; total: string }>(
      "SELECT avg(rating)::text media, count(*)::text total FROM reviews WHERE subject_company_id=$1",
      [user.companyId],
    ),
  ]);
  return {
    media: resumo.rows[0].media === null ? null : Number(resumo.rows[0].media),
    total: Number(resumo.rows[0].total),
    reviews: reviews.rows.map((row) => ({
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at.toISOString(),
      autor: row.autor,
    })),
  };
});
