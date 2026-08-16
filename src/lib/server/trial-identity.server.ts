import { createHmac } from "node:crypto";

function documentHashSecret() {
  const configured = process.env.DOCUMENT_HASH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return "central-local-document-secret-change-me";
  throw new Error("A proteção de CPF/CNPJ ainda não foi configurada pelo administrador");
}

export function hashTrialDocument(normalizedDocument: string) {
  return createHmac("sha256", documentHashSecret()).update(normalizedDocument).digest("hex");
}
