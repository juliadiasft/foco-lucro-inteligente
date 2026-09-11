import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AccountType } from "../account";
import { validateBrazilianDocument } from "../brazilian-document";
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "../server/auth.server";
import { query, transaction } from "../server/db.server";
import { clearRateLimit, consumeRateLimit } from "../server/rate-limit.server";
import { hashTrialDocument, hashesConhecidosDoDocumento } from "../server/trial-identity.server";
import { avaliarFornecedor, type Motivo } from "../fornecedor-sinais";
import { consultarCnpjNaReceita } from "../server/receita.server";

type Verificacao = {
  status: "aprovado" | "em_analise";
  cnae: string | null;
  descricao: string | null;
  motivos: Motivo[];
  abertaEm: string | null;
  situacao: string | null;
  porte: string | null;
  capital: number | null;
  consultou: boolean;
};

// Decide se a vitrine de um fornecedor novo pode ir ao ar sem revisao.
//
// A consulta acontece no servidor de proposito. O cadastro ja consulta a
// Receita pelo navegador para preencher os campos, mas aquilo e conveniencia:
// o que o navegador manda pode ser forjado, e aqui a resposta decide uma
// permissao. Quem verifica precisa perguntar por conta propria.
//
// Falha de rede nao derruba o cadastro. A conta entra em analise, que e o
// padrao seguro: a pessoa usa o sistema e monta o catalogo, e so a publicacao
// espera. Recusar cadastro porque um servico de terceiro caiu seria perder
// fornecedor por motivo que nao e dele.
//
// O que decide esta em src/lib/fornecedor-sinais.ts: ramo, situacao, idade,
// porte, capital e telefone repetido. Aqui so se busca e se guarda.
async function verificarFornecedor(cnpj: string): Promise<Verificacao> {
  try {
    const dados = await consultarCnpjNaReceita(cnpj);
    // A lista de prospeccao ja sabe quantas empresas dividem o telefone
    // desta. Quem nao esta na lista conta como sozinha — ausencia de dado nao
    // e sinal de nada.
    const naLista = await query<{ contatos_iguais: number }>(
      "SELECT contatos_iguais FROM prospects WHERE cnpj=$1 LIMIT 1",
      [cnpj],
    );
    const avaliacao = avaliarFornecedor(dados, {
      contatosIguais: naLista.rows[0]?.contatos_iguais ?? 1,
    });
    return {
      status: avaliacao.decisao,
      cnae: dados.cnae_fiscal ? String(dados.cnae_fiscal) : null,
      descricao: dados.cnae_fiscal_descricao?.trim() || null,
      motivos: avaliacao.motivos,
      abertaEm: avaliacao.abertaEm,
      situacao: avaliacao.situacao,
      porte: avaliacao.porte,
      capital: avaliacao.capital,
      consultou: true,
    };
  } catch {
    return {
      status: "em_analise",
      cnae: null,
      descricao: null,
      // Sem isto a empresa aparece na fila sem explicacao nenhuma, e quem
      // revisa nao sabe se ha algo errado com ela ou so com a internet.
      motivos: [
        {
          peso: "atencao",
          texto:
            "A Receita nao respondeu na hora do cadastro. Nada contra a empresa — confira o CNPJ antes de aprovar.",
        },
      ],
      abertaEm: null,
      situacao: null,
      porte: null,
      capital: null,
      consultou: false,
    };
  }
}

function semVerificacao(accountType: AccountType): Verificacao {
  const fornecedor = accountType === "fornecedor";
  return {
    // Comerciante nao passa por esta fila. Fornecedor que se cadastrou com
    // CPF vai para analise: pessoa fisica pode fornecer, mas ai alguem olha.
    status: fornecedor ? "em_analise" : "aprovado",
    cnae: null,
    descricao: null,
    motivos: fornecedor
      ? [
          {
            peso: "atencao",
            texto:
              "Cadastrou com CPF. Pessoa fisica pode fornecer, mas nao ha dado da Receita para conferir.",
          },
        ]
      : [],
    abertaEm: null,
    situacao: null,
    porte: null,
    capital: null,
    consultou: false,
  };
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  accountType: z.enum(["comerciante", "fornecedor"]),
  segments: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  city: z.string().trim().max(120).optional(),
  uf: z.string().trim().length(2).toUpperCase().optional(),
  phone: z.string().trim().max(30).optional(),
  document: z.string().trim().min(11).max(24),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Aceite os termos para continuar" }),
  }),
});

export const registerAccount = createServerFn({ method: "POST" })
  .validator(registerSchema)
  .handler(async ({ data }) => {
    const document = validateBrazilianDocument(data.document);
    if (!document) throw new Error("Informe um CPF ou CNPJ válido");
    const documentHash = hashTrialDocument(document.normalized);
    const allowed = await consumeRateLimit("register", documentHash, 5, 60 * 60);
    if (!allowed) throw new Error("Muitas tentativas de cadastro. Tente novamente mais tarde.");
    const passwordHash = await hashPassword(data.password);
    try {
      // Fora da transacao: e uma chamada de rede, e segurar a transacao aberta
      // esperando servidor de terceiro prende conexao do banco a toa.
      const verificacao =
        data.accountType === "fornecedor" && document.type === "cnpj"
          ? await verificarFornecedor(document.normalized)
          : semVerificacao(data.accountType);

      const userId = await transaction(async (client) => {
        const company = await client.query<{ id: string }>(
          `INSERT INTO companies
             (name, account_type, city, uf, supplier_verification, supplier_cnae,
              supplier_cnae_descricao, supplier_motivos, receita_aberta_em, receita_situacao,
              receita_porte, receita_capital, receita_consultada_em)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,
                   CASE WHEN $13::boolean THEN now() END)
           RETURNING id`,
          [
            data.company,
            data.accountType,
            data.city || null,
            data.uf || null,
            verificacao.status,
            verificacao.cnae,
            verificacao.descricao,
            JSON.stringify(verificacao.motivos),
            verificacao.abertaEm,
            verificacao.situacao,
            verificacao.porte,
            verificacao.capital,
            verificacao.consultou,
          ],
        );
        const companyId = company.rows[0].id;
        // Só aceita nichos do catálogo: o INSERT ... SELECT descarta qualquer
        // valor que não exista em segments, sem derrubar o cadastro.
        await client.query(
          `INSERT INTO company_segments (company_id, segment_id)
           SELECT $1, id FROM segments WHERE id = ANY($2::text[])
           ON CONFLICT DO NOTHING`,
          [companyId, data.segments],
        );
        // A trava do teste grátis. O INSERT sozinho já barra quem repete o
        // documento, porque o hash é a chave primária — mas só o hash de
        // agora. Depois de uma troca de segredo, quem se cadastrou antes tem
        // no banco um hash calculado com o segredo velho, e o INSERT passaria
        // limpo: a mesma empresa ganharia um segundo teste grátis.
        //
        // Por isso a pergunta é feita antes, contra todos os hashes que este
        // documento pode ter tido.
        const jaUsou = await client.query<{ um: number }>(
          `SELECT 1 um FROM trial_identity_claims WHERE document_hash = ANY($1::text[]) LIMIT 1`,
          [hashesConhecidosDoDocumento(document.normalized)],
        );
        if (jaUsou.rows.length) throw new Error("Este CPF ou CNPJ já utilizou o teste grátis");

        await client.query(
          `INSERT INTO trial_identity_claims (document_hash,document_type,document_last4,company_id)
           VALUES ($1,$2,$3,$4)`,
          [documentHash, document.type, document.last4, companyId],
        );
        const user = await client.query<{ id: string }>(
          `INSERT INTO users (company_id, name, email, phone, password_hash, role, terms_accepted_at, terms_version)
           VALUES ($1, $2, $3, $4, $5, 'owner', now(), '2026-08-12') RETURNING id`,
          [companyId, data.name, data.email, data.phone || null, passwordHash],
        );
        await client.query(
          `INSERT INTO subscriptions (company_id, plan, status)
           VALUES ($1, 'profissional', 'trialing')`,
          [companyId],
        );

        // Se esta empresa estava na lista de prospecção, ela deixa de ser
        // alguém para ligar e passa a ser cliente. A tela mostra isso, e quem
        // está prospectando para de gastar ligação com quem já assinou.
        //
        // Acontece aqui, no cadastro, e não num script rodado à mão depois:
        // o fornecedor se cadastra às onze da noite, e a pessoa que ia ligar
        // para ele abre a lista às oito da manhã. Entre uma coisa e outra não
        // existe ninguém para rodar script nenhum.
        //
        // Só para CNPJ. A lista é de empresas, e comparar o CPF de uma pessoa
        // física contra ela não acharia nada — só levaria um documento pessoal
        // a uma consulta que não tem motivo para recebê-lo.
        if (document.type === "cnpj") {
          await client.query(
            `UPDATE prospects
                SET company_id = $2,
                    status = CASE WHEN status IN ('a contatar','contatado','respondeu')
                                  THEN 'cadastrou' ELSE status END,
                    atualizado_em = now()
              WHERE cnpj = $1 AND company_id IS NULL`,
            [document.normalized, companyId],
          );
        }
        return user.rows[0].id;
      });
      await clearRateLimit("register", documentHash);
      await createSession(userId);
      return { ok: true };
    } catch (error) {
      const databaseError = error as { code?: string; constraint?: string };
      if (databaseError.code === "23505") {
        if (databaseError.constraint === "trial_identity_claims_pkey")
          throw new Error("Este CPF ou CNPJ já utilizou o teste grátis");
        throw new Error("Este email já está cadastrado");
      }
      throw error;
    }
  });

export const loginAccount = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const allowed = await consumeRateLimit("login", data.email, 10, 15 * 60);
    if (!allowed) throw new Error("Email ou senha inválidos");
    const result = await query<{
      id: string;
      password_hash: string;
      active: boolean;
      account_type: AccountType;
    }>(
      `SELECT u.id, u.password_hash, u.active, c.account_type
         FROM users u JOIN companies c ON c.id = u.company_id
        WHERE u.email = $1 LIMIT 1`,
      [data.email],
    );
    const user = result.rows[0];
    if (!user || !user.active || !(await verifyPassword(data.password, user.password_hash))) {
      throw new Error("Email ou senha inválidos");
    }
    await clearRateLimit("login", data.email);
    await query("DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", [user.id]);
    await createSession(user.id);
    return { ok: true, accountType: user.account_type };
  });

export const logoutAccount = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () =>
  getSessionUser(),
);
