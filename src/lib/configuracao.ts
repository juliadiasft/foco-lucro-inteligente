// O que precisa estar configurado para o produto funcionar — e o que quebra
// quando não está.
//
// Existe por causa de 17/09/2026: o DOCUMENT_HASH_SECRET no Render tinha 26
// caracteres, dois a menos que o mínimo, e isso derrubou TODO cadastro novo
// por uma semana. A Julia prospectou fornecedores em Campinas, todos toparam
// conhecer a plataforma, e nenhum conseguiu entrar. Ninguém avisou: o site
// respondia, o banco respondia, o monitor dizia "ok".
//
// A lição não é "conferir melhor". É que falha de configuração precisa gritar
// em algum lugar que alguém olha.

export const TAMANHO_MINIMO_DO_SEGREDO = 32;

export type ProblemaDeConfiguracao = {
  chave: string;
  oQueQuebra: string;
  comoResolver: string;
};

type Ambiente = Record<string, string | undefined>;

/**
 * Os problemas de configuração que impedem o produto de funcionar.
 *
 * Só olha o que, faltando, quebra algo para o cliente — não é lista de
 * desejos. Fora de produção não reclama: o desenvolvimento tem valores
 * padrão para tudo isto.
 */
export function problemasDeConfiguracao(env: Ambiente): ProblemaDeConfiguracao[] {
  if (env.NODE_ENV !== "production") return [];
  const problemas: ProblemaDeConfiguracao[] = [];

  const segredo = env.DOCUMENT_HASH_SECRET ?? "";
  if (segredo.length < TAMANHO_MINIMO_DO_SEGREDO)
    problemas.push({
      chave: "DOCUMENT_HASH_SECRET",
      oQueQuebra:
        segredo.length === 0
          ? "Ninguém consegue criar conta: o cadastro para no primeiro passo."
          : `Ninguém consegue criar conta: o segredo tem ${segredo.length} caracteres e o mínimo é ${TAMANHO_MINIMO_DO_SEGREDO}.`,
      comoResolver:
        "No Render, em Environment, troque DOCUMENT_HASH_SECRET por um valor de 40 caracteres ou mais e salve. Não apague o DOCUMENT_HASH_SECRET_ANTERIOR.",
    });

  return problemas;
}

/** Uma linha por problema, para o log do servidor. */
export function avisoParaOLog(problemas: ProblemaDeConfiguracao[]) {
  if (!problemas.length) return null;
  return problemas
    .map((p) => `CONFIGURACAO FALTANDO — ${p.chave}: ${p.oQueQuebra} ${p.comoResolver}`)
    .join("\n");
}
