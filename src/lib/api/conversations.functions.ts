import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSession } from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { sendCompanyPush } from "../server/push.server";
import { consumeRateLimit } from "../server/rate-limit.server";

const MESSAGE_MAX = 4000;

type ConversationRow = {
  id: string;
  counterpart_company_id: string;
  counterpart_name: string;
  city: string | null;
  uf: string | null;
  last_message_at: Date;
  last_body: string | null;
  unread: string;
};

// Um usuário só alcança conversas da própria empresa. Toda função confere
// isso pelo company_id da sessão, nunca por um identificador vindo do cliente.
export const listConversations = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireActiveSession();
  const result = await query<ConversationRow>(
    `SELECT c.id,
            other.id counterpart_company_id,
            coalesce(sp.display_name, other.name) counterpart_name,
            other.city, other.uf,
            c.last_message_at,
            (SELECT m.body FROM messages m WHERE m.conversation_id=c.id
              ORDER BY m.created_at DESC LIMIT 1) last_body,
            (SELECT count(*) FROM messages m
              WHERE m.conversation_id=c.id
                AND m.sender_company_id <> $1
                AND m.created_at > coalesce(
                      (SELECT r.last_read_at FROM conversation_reads r
                        WHERE r.conversation_id=c.id AND r.user_id=$2),
                      'epoch'::timestamptz))::text unread
       FROM conversations c
       JOIN companies other
         ON other.id = CASE WHEN c.merchant_company_id=$1
                            THEN c.supplier_company_id ELSE c.merchant_company_id END
       LEFT JOIN supplier_profiles sp ON sp.company_id = other.id
      WHERE c.merchant_company_id=$1 OR c.supplier_company_id=$1
      ORDER BY c.last_message_at DESC
      LIMIT 100`,
    [user.companyId, user.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    counterpartName: row.counterpart_name,
    city: row.city,
    uf: row.uf,
    lastMessageAt: row.last_message_at.toISOString(),
    lastBody: row.last_body,
    unread: Number(row.unread),
  }));
});

export const getConversation = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    const conversation = await query<{
      id: string;
      counterpart_name: string;
      city: string | null;
      uf: string | null;
    }>(
      `SELECT c.id, coalesce(sp.display_name, other.name) counterpart_name, other.city, other.uf
         FROM conversations c
         JOIN companies other
           ON other.id = CASE WHEN c.merchant_company_id=$2
                              THEN c.supplier_company_id ELSE c.merchant_company_id END
         LEFT JOIN supplier_profiles sp ON sp.company_id = other.id
        WHERE c.id=$1 AND (c.merchant_company_id=$2 OR c.supplier_company_id=$2)`,
      [data.id, user.companyId],
    );
    if (!conversation.rows[0]) throw new Error("Conversa não encontrada");

    const messages = await query<{
      id: string;
      body: string;
      created_at: Date;
      sender_company_id: string;
      sender_name: string | null;
    }>(
      `SELECT m.id, m.body, m.created_at, m.sender_company_id, u.name sender_name
         FROM messages m LEFT JOIN users u ON u.id=m.sender_user_id
        WHERE m.conversation_id=$1
        ORDER BY m.created_at
        LIMIT 300`,
      [data.id],
    );

    return {
      id: conversation.rows[0].id,
      counterpartName: conversation.rows[0].counterpart_name,
      city: conversation.rows[0].city,
      uf: conversation.rows[0].uf,
      messages: messages.rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at.toISOString(),
        mine: row.sender_company_id === user.companyId,
        senderName: row.sender_name,
      })),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      conversationId: z.string().uuid().optional(),
      supplierCompanyId: z.string().uuid().optional(),
      body: z.string().trim().min(1).max(MESSAGE_MAX),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    // Trava de volume: protege contra abuso e contra o banco crescer sem
    // controle, que é o que mais pesa no plano gratuito.
    const allowed = await consumeRateLimit(`mensagem:${user.companyId}`, user.id, 60, 60 * 60);
    if (!allowed) throw new Error("Muitas mensagens em pouco tempo. Tente novamente mais tarde.");

    const { conversationId, counterpartCompanyId } = await transaction(async (client) => {
      if (data.conversationId) {
        const existing = await client.query<{
          id: string;
          merchant_company_id: string;
          supplier_company_id: string;
        }>(
          `SELECT id, merchant_company_id, supplier_company_id FROM conversations
            WHERE id=$1 AND (merchant_company_id=$2 OR supplier_company_id=$2)`,
          [data.conversationId, user.companyId],
        );
        const row = existing.rows[0];
        if (!row) throw new Error("Conversa não encontrada");
        return {
          conversationId: row.id,
          counterpartCompanyId:
            row.merchant_company_id === user.companyId
              ? row.supplier_company_id
              : row.merchant_company_id,
        };
      }

      // Só o comerciante abre conversa. O fornecedor responde, mas não sai
      // abordando comerciante que não procurou por ele.
      if (user.accountType !== "comerciante")
        throw new Error("Apenas o comerciante pode iniciar uma conversa");
      if (!data.supplierCompanyId) throw new Error("Escolha um fornecedor");

      const supplier = await client.query<{ id: string }>(
        `SELECT c.id FROM companies c
           JOIN supplier_profiles sp ON sp.company_id=c.id AND sp.published=true
          WHERE c.id=$1 AND c.account_type='fornecedor'`,
        [data.supplierCompanyId],
      );
      if (!supplier.rows[0]) throw new Error("Fornecedor não encontrado");

      const created = await client.query<{ id: string }>(
        `INSERT INTO conversations (merchant_company_id, supplier_company_id)
         VALUES ($1,$2)
         ON CONFLICT (merchant_company_id, supplier_company_id)
           DO UPDATE SET last_message_at=now()
         RETURNING id`,
        [user.companyId, data.supplierCompanyId],
      );
      return {
        conversationId: created.rows[0].id,
        counterpartCompanyId: data.supplierCompanyId,
      };
    });

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO messages (conversation_id, sender_company_id, sender_user_id, body)
         VALUES ($1,$2,$3,$4)`,
        [conversationId, user.companyId, user.id, data.body],
      );
      await client.query("UPDATE conversations SET last_message_at=now() WHERE id=$1", [
        conversationId,
      ]);
      await client.query(
        `INSERT INTO conversation_reads (conversation_id,user_id,last_read_at)
         VALUES ($1,$2,now())
         ON CONFLICT (conversation_id,user_id) DO UPDATE SET last_read_at=now()`,
        [conversationId, user.id],
      );
    });

    // O aviso no celular reaproveita a infraestrutura de push que já existia.
    //
    // O endereço é o de quem RECEBE, e já com a conversa aberta. Antes ia
    // sempre "/conversas", que é a tela do comerciante: o fornecedor tocava na
    // notificação e caía no painel dele, porque o guarda de rota o manda para
    // fora das telas de comerciante — e a mensagem ficava para ele achar.
    const telaDeQuemRecebe =
      user.accountType === "comerciante" ? "/fornecedor/conversas" : "/conversas";
    void sendCompanyPush(counterpartCompanyId, {
      title: `Nova mensagem de ${user.companyName}`,
      body: data.body.slice(0, 120),
      url: `${telaDeQuemRecebe}?aberto=${conversationId}`,
      tag: `conversa:${conversationId}`,
    }).catch((error) => console.error("Falha ao notificar mensagem", error));

    return { conversationId };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireActiveSession();
    await query(
      `INSERT INTO conversation_reads (conversation_id,user_id,last_read_at)
       SELECT id,$2,now() FROM conversations
        WHERE id=$1 AND (merchant_company_id=$3 OR supplier_company_id=$3)
       ON CONFLICT (conversation_id,user_id) DO UPDATE SET last_read_at=now()`,
      [data.id, user.id, user.companyId],
    );
    return { ok: true };
  });
