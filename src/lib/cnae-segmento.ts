// De CNAE para o nicho da Central.
//
// O CNAE vem da Receita com sete dígitos (o "4712-1/00" vira 4712100). A
// Receita entrega o campo como número, então 0600-0/01 chega como 600001 e
// precisa de zero à esquerda antes de qualquer comparação — sem isso, todo
// CNAE que começa com zero cai no grupo errado.
//
// O casamento é por GRUPO (os quatro primeiros dígitos) e não pela subclasse
// inteira: a subclasse muda com mais frequência e é mais fácil de errar, e o
// grupo já separa açougue de padaria com folga.
//
// Isto é um palpite bem informado, não uma verdade. Um mesmo comércio pode ter
// CNAE que não descreve o que ele realmente vende, e há CNAE que serve a dois
// nichos. Por isso o nicho sugerido aqui chega na tela marcado mas editável, e
// a tela diz que veio do CNAE — quem cadastra confirma ou troca.

const POR_GRUPO: Record<string, string> = {
  "4711": "mercado", // hipermercados e supermercados
  "4712": "mercearia", // minimercados, mercearias e armazéns
  "4713": "utilidades", // lojas de departamentos e de variedades
  "4721": "padaria", // padaria e confeitaria
  "4722": "acougue", // carnes, açougues e peixarias
  "4723": "bar", // comércio varejista de bebidas
  "4724": "hortifruti", // hortifrutigranjeiros
  "4635": "distribuidora", // atacado de bebidas
  "4744": "construcao", // material de construção
  "4751": "eletronicos", // informática
  "4752": "eletronicos", // telefonia e comunicação
  "4753": "eletronicos", // eletrodomésticos
  "4759": "utilidades", // outros artigos de uso doméstico
  "4761": "papelaria", // livros, jornais, revistas e papelaria
  "4771": "farmacia", // farmácias e drogarias
  "4772": "cosmeticos", // cosméticos, perfumaria e higiene pessoal
  "4781": "roupas", // vestuário e acessórios
  "4782": "calcados", // calçados
  "4530": "autopecas", // peças e acessórios para veículos
  "5611": "lanchonete", // restaurantes e lanchonetes
};

// A subclasse ganha do grupo quando ela diz algo que o grupo esconde. O caso
// clássico é 5611-2/05: está no grupo dos restaurantes, mas é bar.
const POR_SUBCLASSE: Record<string, string> = {
  "5611205": "bar", // bares e outros estabelecimentos de bebidas
  "4789004": "pet", // animais para criação doméstica
  "9609208": "pet", // higiene e embelezamento de animais domésticos
};

/** Normaliza o CNAE para os sete dígitos com zero à esquerda. */
export function normalizarCnae(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined) return null;
  const digitos = String(valor).replace(/\D/g, "");
  if (!digitos) return null;
  return digitos.padStart(7, "0").slice(0, 7);
}

/** O nicho sugerido para um CNAE, ou null quando não dá para dizer. */
export function segmentoDoCnae(valor: string | number | null | undefined) {
  const cnae = normalizarCnae(valor);
  if (!cnae) return null;
  return POR_SUBCLASSE[cnae] || POR_GRUPO[cnae.slice(0, 4)] || null;
}

/**
 * Olha o CNAE principal e os secundários e devolve os nichos sem repetição, na
 * ordem em que apareceram. O principal vem primeiro: é o que a empresa declara
 * como atividade central.
 */
export function segmentosSugeridos(
  principal: string | number | null | undefined,
  secundarios: Array<string | number> = [],
) {
  const encontrados: string[] = [];
  for (const codigo of [principal, ...secundarios]) {
    const segmento = segmentoDoCnae(codigo);
    if (segmento && !encontrados.includes(segmento)) encontrados.push(segmento);
  }
  return encontrados;
}
