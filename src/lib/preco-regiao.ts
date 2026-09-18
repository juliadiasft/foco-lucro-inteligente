// Quando o preço do fornecedor está acima do que os concorrentes da região
// cobram pelo mesmo item.
//
// Regras que protegem contra aviso injusto: precisa de pelo menos dois outros
// fornecedores (um só não é "região", é um concorrente), e só avisa acima de 5%
// — abaixo disso é ruído de embalagem e arredondamento.

export const MIN_CONCORRENTES = 2;
export const MARGEM_PARA_AVISAR = 0.05;

export function precoAcimaDaRegiao(entrada: {
  meuPreco: number;
  medianaDosOutros: number;
  concorrentes: number;
}) {
  const { meuPreco, medianaDosOutros, concorrentes } = entrada;
  if (concorrentes < MIN_CONCORRENTES) return null;
  if (!(meuPreco > 0) || !(medianaDosOutros > 0)) return null;
  if (meuPreco <= medianaDosOutros * (1 + MARGEM_PARA_AVISAR)) return null;
  return {
    diferenca: meuPreco - medianaDosOutros,
    percentual: ((meuPreco - medianaDosOutros) / medianaDosOutros) * 100,
  };
}
