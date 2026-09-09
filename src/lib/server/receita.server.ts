// Consulta ao CNPJ nos Dados Abertos da Receita Federal, servidos pela
// BrasilAPI.
//
// Mora aqui, e não dentro de uma server function, porque dois caminhos
// precisam dela: o autopreenchimento do cadastro e a verificação do
// fornecedor. Duplicar significaria, cedo ou tarde, corrigir um e esquecer o
// outro.

const BRASIL_API = "https://brasilapi.com.br/api/cnpj/v1";
const TEMPO_LIMITE_MS = 8000;

// Sem User-Agent a BrasilAPI devolve 403. O fetch do Node não manda um por
// conta própria, então a chamada funcionava no curl e falhava no servidor —
// exatamente o tipo de erro que só apareceria em produção, com alguém tentando
// se cadastrar. Identificar quem está chamando também é educado com um serviço
// público e gratuito.
const USER_AGENT = "CentralDoComerciante/1.0 (+https://central-do-comerciante.onrender.com)";

export type RespostaReceita = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cnae_fiscal?: number | string | null;
  cnae_fiscal_descricao?: string | null;
  cnaes_secundarios?: Array<{ codigo?: number | string | null }> | null;
  descricao_situacao_cadastral?: string | null;
  ddd_telefone_1?: string | null;
};

export class CnpjNaoEncontrado extends Error {}
export class ReceitaIndisponivel extends Error {}

/**
 * Busca um CNPJ (apenas dígitos) na Receita.
 *
 * Lança `CnpjNaoEncontrado` quando a base não tem o número, e
 * `ReceitaIndisponivel` para qualquer outra falha — quem chama decide se isso
 * interrompe a operação ou apenas muda o caminho.
 */
export async function consultarCnpjNaReceita(cnpj: string): Promise<RespostaReceita> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BRASIL_API}/${cnpj}`, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
  } catch {
    throw new ReceitaIndisponivel("A Receita não respondeu a tempo");
  }

  if (resposta.status === 404) throw new CnpjNaoEncontrado("CNPJ não encontrado");
  if (!resposta.ok) {
    // O CNPJ inteiro nunca vai para o log.
    console.error(`[cnpj] BrasilAPI respondeu ${resposta.status}`);
    throw new ReceitaIndisponivel(`A Receita respondeu ${resposta.status}`);
  }

  const dados = (await resposta.json().catch(() => null)) as RespostaReceita | null;
  if (!dados) throw new ReceitaIndisponivel("Resposta da Receita ilegível");
  return dados;
}
