// O atendimento humano da Central: o WhatsApp da Julia.
//
// Mora aqui, e não dentro do botão de ajuda, porque mais de uma tela manda a
// pessoa para lá — o botão de ajuda, e a troca de plano de quem já assina,
// que a Cakto não deixa fazer sozinha.

// Com o 55 do Brasil na frente — é o formato que o wa.me exige. Fica no código
// e não numa variável de ambiente de propósito: é um número de atendimento,
// feito para o cliente ver, e escondê-lo daria a entender que é dado sensível
// quando o objetivo é justamente divulgá-lo.
export const WHATSAPP_ATENDIMENTO = "5519994171970";

/**
 * Link que abre a conversa já com a mensagem escrita. Sem mensagem, a pessoa
 * cai numa caixa vazia e tem que formular o problema do zero — que é
 * exatamente onde quem está travado desiste.
 */
export function linkDoAtendimento(mensagem: string) {
  return `https://wa.me/${WHATSAPP_ATENDIMENTO}?text=${encodeURIComponent(mensagem)}`;
}
