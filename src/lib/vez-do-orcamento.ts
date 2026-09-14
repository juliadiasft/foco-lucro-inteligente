// De quem é a vez num orçamento: de quem NÃO deu a última palavra.
//
// Sem proposta nenhuma, a vez é do fornecedor — o comerciante acabou de pedir
// preço. Até 14/09/2026 esse caso dava "não é a vez de ninguém", e o pedido de
// orçamento novo, o mais urgente que existe para o fornecedor, chegava sem o
// aviso de "Aguardando você". Orçamento encerrado não espera ninguém.

const ENCERRADOS = new Set(["aceito", "recusado", "cancelado"]);

export function ehMinhaVez({
  status,
  ultimaOrigem,
  minhaEmpresa,
  souComerciante,
}: {
  status: string;
  /** Empresa que mandou a proposta mais recente; null se ainda não há proposta. */
  ultimaOrigem: string | null;
  minhaEmpresa: string;
  souComerciante: boolean;
}) {
  if (ENCERRADOS.has(status)) return false;
  if (ultimaOrigem === null) return !souComerciante;
  return ultimaOrigem !== minhaEmpresa;
}
