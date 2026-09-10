import { createHmac } from "node:crypto";

// O CPF/CNPJ de quem se cadastra nunca é guardado. O que fica é este hash, que
// serve para uma pergunta só: este documento já usou o teste grátis?
//
// O segredo é o que impede o hash de ser adivinhável. Sem ele, qualquer pessoa
// com uma cópia do banco calcularia o hash de todos os CNPJs do país — a lista
// inteira está publicada nos Dados Abertos da Receita — e descobriria quem é
// cliente da Central. Com ele, não dá.

function segredoAtual() {
  const configured = process.env.DOCUMENT_HASH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return "central-local-document-secret-change-me";
  throw new Error("A proteção de CPF/CNPJ ainda não foi configurada pelo administrador");
}

// Segredos que já foram o atual um dia, separados por vírgula. Servem só para
// reconhecer o que foi gravado antes da troca — nada novo é gravado com eles.
//
// Isto existe porque, sem isso, trocar o segredo tinha um custo escondido e
// caro: os hashes antigos deixam de bater, e a trava do teste grátis perde a
// memória. Todo mundo que já se cadastrou ganharia um segundo teste grátis, e
// ninguém perceberia até a receita não aparecer.
//
// Um segredo exposto precisa ser trocado no mesmo dia. Se a troca custa a
// memória das travas, ela é adiada — e adiar é como um segredo exposto vira
// permanente. Com esta lista, trocar não custa nada.
function segredosAnteriores() {
  return (process.env.DOCUMENT_HASH_SECRET_ANTERIOR || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 32);
}

/** O hash com que documentos novos são gravados. */
export function hashTrialDocument(normalizedDocument: string) {
  return createHmac("sha256", segredoAtual()).update(normalizedDocument).digest("hex");
}

/**
 * Todos os hashes que este documento pode ter no banco: o de agora e os de
 * antes de cada troca de segredo. Quem pergunta "este documento já usou o
 * teste grátis?" precisa olhar todos — perguntar só pelo atual responde "não"
 * para quem se cadastrou antes da última troca.
 */
export function hashesConhecidosDoDocumento(normalizedDocument: string) {
  const todos = [segredoAtual(), ...segredosAnteriores()];
  return todos.map((segredo) =>
    createHmac("sha256", segredo).update(normalizedDocument).digest("hex"),
  );
}
