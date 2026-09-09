import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { segmentosSugeridos } from "../cnae-segmento";
import { consumeRateLimit } from "../server/rate-limit.server";

// Preenche o cadastro a partir do CNPJ, com os Dados Abertos da Receita
// Federal servidos pela BrasilAPI. Some quatro campos do formulário de quem
// está se cadastrando — e formulário curto é cadastro que termina.
//
// Roda no servidor, nunca no navegador: do lado do cliente esbarraria em CORS,
// e mais importante, não daria para limitar o uso. Uma consulta de CNPJ aberta
// e sem limite vira, em poucos dias, alguém usando a Central como proxy grátis
// de raspagem da base da Receita.
//
// Esta é a única chamada da Central a um serviço de fora que responde antes do
// login. Se a BrasilAPI cair, o cadastro continua funcionando na unha: a tela
// avisa e deixa digitar. Autopreenchimento que trava o cadastro quando falha é
// pior do que não ter autopreenchimento.

const BRASIL_API = "https://brasilapi.com.br/api/cnpj/v1";
const TEMPO_LIMITE_MS = 8000;

// Sem User-Agent a BrasilAPI devolve 403. O fetch do Node não manda um por
// conta própria, então a chamada funcionava no curl e falhava no servidor —
// exatamente o tipo de erro que só apareceria em produção, com alguém tentando
// se cadastrar. Identificar quem está chamando também é educado com um serviço
// público e gratuito.
const USER_AGENT = "CentralDoComerciante/1.0 (+https://central-do-comerciante.onrender.com)";

type RespostaReceita = {
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

// (11) 91234-5678 a partir de "11912345678". A Receita entrega DDD e número
// grudados, e às vezes com ramal colado no fim.
function formatarTelefone(bruto: string | null | undefined) {
  const digitos = (bruto || "").replace(/\D/g, "");
  if (digitos.length === 11)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return null;
}

export const consultarCnpj = createServerFn({ method: "POST" })
  .validator(
    z.object({
      cnpj: z
        .string()
        .trim()
        .transform((valor) => valor.replace(/\D/g, ""))
        .refine((digitos) => digitos.length === 14, "Informe os 14 dígitos do CNPJ"),
    }),
  )
  .handler(async ({ data }) => {
    // A chave é o endereço de quem pede, porque aqui não existe sessão. Sem
    // isso, um único script esgotaria a cota da BrasilAPI para todo mundo.
    const origem =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "desconhecido";
    const liberado = await consumeRateLimit("cnpj", origem, 30, 60 * 60);
    if (!liberado) {
      throw new Error("Muitas consultas seguidas. Espere alguns minutos ou preencha à mão.");
    }

    let resposta: Response;
    try {
      resposta = await fetch(`${BRASIL_API}/${data.cnpj}`, {
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
    } catch {
      // Serviço fora do ar ou lento demais. Quem está cadastrando não tem
      // culpa nem conserto para isso: só precisa saber que pode digitar.
      throw new Error("Não consegui consultar a Receita agora. Preencha os dados à mão.");
    }

    if (resposta.status === 404) throw new Error("CNPJ não encontrado na base da Receita.");
    if (!resposta.ok) {
      // O CNPJ inteiro nunca vai para o log.
      console.error(`[cnpj] BrasilAPI respondeu ${resposta.status}`);
      throw new Error("Não consegui consultar a Receita agora. Preencha os dados à mão.");
    }

    const dados = (await resposta.json().catch(() => null)) as RespostaReceita | null;
    if (!dados) throw new Error("Não consegui consultar a Receita agora. Preencha os dados à mão.");

    const situacao = (dados.descricao_situacao_cadastral || "").toUpperCase();
    const secundarios = (dados.cnaes_secundarios || [])
      .map((item) => item?.codigo)
      .filter((codigo): codigo is number | string => codigo !== null && codigo !== undefined);

    return {
      // O nome fantasia é como o comerciante chama a própria loja; a razão
      // social costuma ser um nome que ele nunca usa. Fantasia primeiro.
      nomeEmpresa: dados.nome_fantasia?.trim() || dados.razao_social?.trim() || null,
      razaoSocial: dados.razao_social?.trim() || null,
      cidade: dados.municipio?.trim() || null,
      uf: dados.uf?.trim()?.toUpperCase() || null,
      telefone: formatarTelefone(dados.ddd_telefone_1),
      atividade: dados.cnae_fiscal_descricao?.trim() || null,
      segmentosSugeridos: segmentosSugeridos(dados.cnae_fiscal, secundarios),
      // Vale avisar quando não está ativa, mas não vale bloquear: a Receita
      // demora a atualizar, e recusar cadastro por isso é recusar cliente por
      // um dado que pode estar velho.
      ativa: situacao === "" || situacao === "ATIVA",
      situacao: situacao || null,
    };
  });
