import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { integrationById, integrations } from "../integrations";
import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";

const providerSchema = z.object({
  provider: z.string().trim().min(1).max(40),
});

export const listIntegrations = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const interest = await query<{ provider: string }>(
    "SELECT provider FROM integration_interest WHERE company_id=$1",
    [user.companyId],
  );
  const requested = new Set(interest.rows.map((row) => row.provider));
  return integrations.map((item) => ({ ...item, requested: requested.has(item.id) }));
});

export const requestIntegration = createServerFn({ method: "POST" })
  .validator(providerSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    // Só aceita provedores do catálogo: evita gravar lixo vindo do cliente.
    if (!integrationById.has(data.provider)) throw new Error("Integração não encontrada");
    await query(
      `INSERT INTO integration_interest (company_id,provider,requested_by)
       VALUES ($1,$2,$3) ON CONFLICT (company_id,provider) DO NOTHING`,
      [user.companyId, data.provider, user.id],
    );
    return { ok: true };
  });

export const cancelIntegrationRequest = createServerFn({ method: "POST" })
  .validator(providerSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query("DELETE FROM integration_interest WHERE company_id=$1 AND provider=$2", [
      user.companyId,
      data.provider,
    ]);
    return { ok: true };
  });
