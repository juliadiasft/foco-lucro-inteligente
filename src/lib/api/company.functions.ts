import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { maskedBrazilianDocument, type BrazilianDocumentType } from "../brazilian-document";
import { requireAdmin, requireSession } from "../server/auth.server";
import { query, transaction } from "../server/db.server";

const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  cnpj: z.string().trim().max(24).optional(),
  businessType: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  monthlyRevenueGoal: z.number().min(0).max(999999999),
  expectedAverageTicket: z.number().min(0).max(999999999),
});

type CompanyRow = {
  id: string;
  name: string;
  cnpj: string | null;
  business_type: string | null;
  phone: string | null;
  monthly_revenue_goal: string;
  expected_average_ticket: string;
  plan: "essencial" | "profissional" | "premium";
  subscription_status: string;
  trial_ends_at: Date;
  registration_document_type: BrazilianDocumentType | null;
  registration_document_last4: string | null;
};

function mapCompany(row: CompanyRow) {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    businessType: row.business_type,
    phone: row.phone,
    monthlyRevenueGoal: Number(row.monthly_revenue_goal),
    expectedAverageTicket: Number(row.expected_average_ticket),
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at.toISOString(),
    registrationDocument:
      row.registration_document_type && row.registration_document_last4
        ? maskedBrazilianDocument(row.registration_document_type, row.registration_document_last4)
        : null,
  };
}

export const getCompany = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const result = await query<CompanyRow>(
    `SELECT c.*,t.document_type registration_document_type,
            t.document_last4 registration_document_last4
       FROM companies c
       LEFT JOIN trial_identity_claims t ON t.company_id=c.id
      WHERE c.id=$1`,
    [user.companyId],
  );
  return mapCompany(result.rows[0]);
});

export const updateCompany = createServerFn({ method: "POST" })
  .validator(companySchema)
  .handler(async ({ data }) => {
    const user = await requireSession();
    requireAdmin(user);
    await query(
      `UPDATE companies
          SET name = $2, cnpj = $3, business_type = $4, phone = $5,
              monthly_revenue_goal = $6, expected_average_ticket = $7, updated_at = now()
        WHERE id = $1`,
      [
        user.companyId,
        data.name,
        data.cnpj || null,
        data.businessType || null,
        data.phone || null,
        data.monthlyRevenueGoal,
        data.expectedAverageTicket,
      ],
    );
    const result = await query<CompanyRow>(
      `SELECT c.*,t.document_type registration_document_type,
              t.document_last4 registration_document_last4
         FROM companies c
         LEFT JOIN trial_identity_claims t ON t.company_id=c.id
        WHERE c.id=$1`,
      [user.companyId],
    );
    return mapCompany(result.rows[0]);
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .validator(companySchema)
  .handler(async ({ data }) => {
    const user = await requireSession();
    await transaction(async (client) => {
      await client.query(
        `UPDATE companies
            SET name = $2, cnpj = $3, business_type = $4, phone = $5,
                monthly_revenue_goal = $6, expected_average_ticket = $7, updated_at = now()
          WHERE id = $1`,
        [
          user.companyId,
          data.name,
          data.cnpj || null,
          data.businessType || null,
          data.phone || null,
          data.monthlyRevenueGoal,
          data.expectedAverageTicket,
        ],
      );
      await client.query(
        "UPDATE users SET onboarding_complete = true, updated_at = now() WHERE id = $1",
        [user.id],
      );
    });
    return { ok: true };
  });
