import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession } from "../server/auth.server";
import { query } from "../server/db.server";
import { pushIsConfigured } from "../server/push.server";

// O payload vem de uma coluna jsonb. `unknown` faz a checagem de
// serialização do TanStack Start falhar, porque ela não consegue provar que
// o valor atravessa a fronteira servidor/cliente.
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type NotificationRow = {
  id: string;
  type: "supplier_opportunity" | "stock_alert" | "system";
  title: string;
  message: string;
  action_url: string | null;
  payload: Record<string, JsonValue>;
  created_at: Date;
  read_at: Date | null;
};

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const result = await query<NotificationRow>(
    `SELECT n.id,n.type,n.title,n.message,n.action_url,n.payload,n.created_at,nr.read_at
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id=n.id AND nr.user_id=$2
      WHERE n.company_id=$1 AND (n.expires_at IS NULL OR n.expires_at>now())
      ORDER BY n.created_at DESC LIMIT 30`,
    [user.companyId, user.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url,
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
    read: Boolean(row.read_at),
  }));
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query(
      `INSERT INTO notification_reads (notification_id,user_id)
       SELECT id,$2 FROM notifications WHERE id=$1 AND company_id=$3
       ON CONFLICT (notification_id,user_id) DO UPDATE SET read_at=now()`,
      [data.id, user.id, user.companyId],
    );
    return { ok: true };
  });

export const getPushConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const status = await query<{ count: string }>(
    "SELECT count(*)::text count FROM push_subscriptions WHERE user_id=$1 AND active=true",
    [user.id],
  );
  return {
    configured: pushIsConfigured(),
    publicKey: pushIsConfigured() ? process.env.VAPID_PUBLIC_KEY || null : null,
    activeDevices: Number(status.rows[0].count),
  };
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2500),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(1000),
    auth: z.string().min(10).max(500),
  }),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .validator(pushSubscriptionSchema)
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    if (!pushIsConfigured()) throw new Error("Notificações no celular ainda não foram ativadas");
    await query(
      `INSERT INTO push_subscriptions (company_id,user_id,endpoint,p256dh,auth,user_agent)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (endpoint) DO UPDATE SET company_id=excluded.company_id,user_id=excluded.user_id,
         p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,active=true,
         last_error=null,updated_at=now()`,
      [user.companyId, user.id, data.endpoint, data.keys.p256dh, data.keys.auth, null],
    );
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .validator(z.object({ endpoint: z.string().url().max(2500) }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query(
      "UPDATE push_subscriptions SET active=false,updated_at=now() WHERE endpoint=$1 AND user_id=$2",
      [data.endpoint, user.id],
    );
    return { ok: true };
  });
