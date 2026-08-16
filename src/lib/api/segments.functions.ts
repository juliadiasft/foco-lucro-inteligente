import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession, requireAdmin } from "../server/auth.server";
import { query, transaction } from "../server/db.server";

// Lista pública: a tela de cadastro precisa dela antes de existir sessão.
// Não expõe nada de nenhuma empresa, só o catálogo de nichos.
export const listSegments = createServerFn({ method: "GET" }).handler(async () => {
  const result = await query<{ id: string; name: string }>(
    "SELECT id,name FROM segments ORDER BY sort_order, name",
  );
  return result.rows.map((row) => ({ id: row.id, name: row.name }));
});

export const getCompanyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const [company, segments, audience] = await Promise.all([
    query<{ name: string; city: string | null; uf: string | null }>(
      "SELECT name,city,uf FROM companies WHERE id=$1",
      [user.companyId],
    ),
    query<{ segment_id: string; name: string }>(
      `SELECT cs.segment_id,s.name FROM company_segments cs
         JOIN segments s ON s.id=cs.segment_id
        WHERE cs.company_id=$1 ORDER BY s.sort_order, s.name`,
      [user.companyId],
    ),
    // Quantas empresas do outro lado atuam nos mesmos nichos. É um número
    // agregado: não identifica nenhuma empresa.
    query<{ total: string }>(
      `SELECT count(DISTINCT c.id)::text total
         FROM companies c
         JOIN company_segments cs ON cs.company_id=c.id
        WHERE c.account_type <> $2
          AND cs.segment_id IN (SELECT segment_id FROM company_segments WHERE company_id=$1)`,
      [user.companyId, user.accountType],
    ),
  ]);
  return {
    name: company.rows[0].name,
    city: company.rows[0].city,
    uf: company.rows[0].uf,
    segments: segments.rows.map((row) => ({ id: row.segment_id, name: row.name })),
    audienceCount: Number(audience.rows[0].total),
  };
});

export const updateCompanyProfile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      segments: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
      city: z.string().trim().max(120).optional(),
      uf: z.string().trim().length(2).toUpperCase().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    requireAdmin(user);
    await transaction(async (client) => {
      await client.query("UPDATE companies SET city=$2,uf=$3,updated_at=now() WHERE id=$1", [
        user.companyId,
        data.city || null,
        data.uf || null,
      ]);
      await client.query("DELETE FROM company_segments WHERE company_id=$1", [user.companyId]);
      // O SELECT sobre segments descarta qualquer id que não exista no
      // catálogo, então o cliente não consegue gravar nicho inventado.
      await client.query(
        `INSERT INTO company_segments (company_id, segment_id)
         SELECT $1, id FROM segments WHERE id = ANY($2::text[])`,
        [user.companyId, data.segments],
      );
    });
    return { ok: true };
  });
