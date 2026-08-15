import { planLimits, type PlanName } from "../plans";
import type { SessionUser } from "./auth.server";
import { query, transaction } from "./db.server";

// Cota e chamada de IA em um lugar só. Antes isso vivia dentro do consultor
// do comerciante; com dois consultores, duplicar a lógica de cota levaria
// cedo ou tarde a duas contagens diferentes do mesmo limite.

export function aiModel() {
  return process.env.OPENAI_MODEL || "gpt-5.6-luna";
}

// A vaga é reservada antes da chamada à OpenAI. Contar e só depois gravar
// permitiria que perguntas simultâneas ultrapassassem o limite do plano, o
// que vira custo direto de API.
export async function reserveAiSlot(user: SessionUser, question: string) {
  return transaction(async (client) => {
    const company = await client.query<{ plan: PlanName }>(
      "SELECT plan FROM companies WHERE id=$1 FOR UPDATE",
      [user.companyId],
    );
    const limit = planLimits[company.rows[0].plan].aiRequestsPerMonth;
    const usage = await client.query<{ total: string }>(
      "SELECT count(*)::text total FROM ai_usage WHERE company_id=$1 AND created_at >= date_trunc('month',now())",
      [user.companyId],
    );
    const used = Number(usage.rows[0].total);
    if (used >= limit) throw new Error("Limite mensal de perguntas à IA atingido neste plano");
    const created = await client.query<{ id: string }>(
      `INSERT INTO ai_usage (company_id,user_id,model,question,answer)
       VALUES ($1,$2,$3,$4,'') RETURNING id`,
      [user.companyId, user.id, aiModel(), question],
    );
    return { id: created.rows[0].id, remaining: Math.max(0, limit - used - 1) };
  });
}

export async function releaseAiSlot(id: string) {
  await query("DELETE FROM ai_usage WHERE id=$1 AND answer=''", [id]).catch(() => undefined);
}

export async function completeAiSlot(
  id: string,
  answer: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
) {
  await query("UPDATE ai_usage SET answer=$2,prompt_tokens=$3,output_tokens=$4 WHERE id=$1", [
    id,
    answer,
    usage?.input_tokens || 0,
    usage?.output_tokens || 0,
  ]);
}

export async function askOpenAi(instructions: string, input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("A IA ainda não foi ativada pelo administrador do sistema");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: aiModel(),
      // Nenhuma conversa fica guardada na OpenAI.
      store: false,
      max_output_tokens: 1000,
      instructions,
      input,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };

  if (!response.ok) {
    // A mensagem da OpenAI pode expor modelo, cota e detalhe de conta: fica no
    // log do servidor, não na tela do usuário.
    console.error(
      `[ia] resposta ${response.status} da OpenAI: ${result.error?.message || "sem detalhe"}`,
    );
    throw new Error("Não foi possível consultar a IA agora. Tente novamente em instantes.");
  }

  const answer = (result.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("\n")
    .trim();
  if (!answer) throw new Error("A IA não retornou uma resposta. Tente novamente.");
  return { answer, usage: result.usage };
}
