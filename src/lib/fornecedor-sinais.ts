// Lê o que a Receita diz de um fornecedor e decide se a vitrine pode ir ao ar
// sem ninguém olhar.
//
// O problema que isto resolve é a fachada: empresa que existe no papel, sem
// operação de verdade, publicando preço que ninguém entrega. A avaliação dos
// compradores não pega esse caso, porque fornecedor novo não tem avaliação
// nenhuma — e fachada é, por definição, fornecedor novo. Ela protege do
// segundo golpe em diante; o primeiro pet shop que confia paga a conta.
//
// O que pega é o que a Receita já entrega no cadastro, de graça, e que até
// aqui era jogado fora: situação, idade, porte, capital. Nenhum desses sinais
// sozinho prova nada. Por isso nada aqui recusa: o que parece estranho vai
// para a fila do back office com o motivo escrito, e quem decide é uma pessoa.
// Recusar sozinho seria perder fornecedor de verdade por causa de um número
// que tem explicação.
//
// Fica fora do servidor de propósito: é função pura, testada sem rede, sem
// banco e sem relógio de verdade.

import { cnaeDeFornecedor } from "./cnae-segmento.ts";

export type DadosDaReceita = {
  cnae_fiscal?: number | string | null;
  cnae_fiscal_descricao?: string | null;
  descricao_situacao_cadastral?: string | null;
  data_inicio_atividade?: string | null;
  capital_social?: number | string | null;
  porte?: string | null;
  opcao_pelo_mei?: boolean | null;
};

export type Motivo = {
  // "grave" é o que, se for verdade, impede a empresa de vender dentro da lei.
  // "atencao" é o que costuma ter explicação, mas merece um olhar.
  peso: "grave" | "atencao";
  texto: string;
};

export type Avaliacao = {
  decisao: "aprovado" | "em_analise";
  motivos: Motivo[];
  abertaEm: string | null;
  situacao: string | null;
  porte: string | null;
  capital: number | null;
  mei: boolean;
};

// Abaixo disso a empresa ainda não teve tempo de ter histórico nenhum. Não é
// proibido — todo fornecedor foi novo um dia —, mas é o perfil exato de quem
// abre CNPJ para aplicar golpe e some.
const DIAS_DE_EMPRESA_NOVA = 90;

// Capital social é declarado, não conferido, e muita LTDA honesta declara
// R$ 1.000. Abaixo disso, dizendo ser distribuidora, a conta não fecha.
const CAPITAL_MINIMO_PLAUSIVEL = 1000;

// Uma central de telefone que atende dezenas de CNPJs costuma ser escritório de
// contabilidade — ou uma fábrica de empresas. A lista de prospecção já conta
// quantas empresas dividem o mesmo contato.
const CONTATOS_IGUAIS_SUSPEITOS = 10;

function diasEntre(inicio: string, hoje: Date) {
  const data = new Date(`${inicio}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return null;
  return Math.floor((hoje.getTime() - data.getTime()) / 86_400_000);
}

export function avaliarFornecedor(
  dados: DadosDaReceita,
  {
    hoje = new Date(),
    contatosIguais = 1,
  }: {
    hoje?: Date;
    // Quantas empresas da lista da Receita dividem o telefone desta. 1 quando
    // ela não está na lista ou está sozinha.
    contatosIguais?: number;
  } = {},
): Avaliacao {
  const motivos: Motivo[] = [];

  const situacao = dados.descricao_situacao_cadastral?.trim().toUpperCase() || null;
  // Inapta, suspensa e baixada não podem emitir nota. Baixada nem existe mais.
  // Não publicar é o bastante — e continua na fila, para você ver quem tentou.
  if (situacao && situacao !== "ATIVA")
    motivos.push({
      peso: "grave",
      texto: `A Receita diz que a empresa está ${situacao.toLowerCase()}. Empresa nessa situação não pode emitir nota fiscal.`,
    });

  if (!cnaeDeFornecedor(dados.cnae_fiscal))
    motivos.push({
      peso: "atencao",
      texto: dados.cnae_fiscal_descricao
        ? `O ramo principal é "${dados.cnae_fiscal_descricao.trim()}", que não é de atacado nem de indústria.`
        : "A Receita não informou o ramo de atividade.",
    });

  const abertaEm = dados.data_inicio_atividade?.slice(0, 10) || null;
  const idade = abertaEm ? diasEntre(abertaEm, hoje) : null;
  if (idade !== null && idade < DIAS_DE_EMPRESA_NOVA)
    motivos.push({
      peso: "atencao",
      texto:
        idade <= 1
          ? "A empresa foi aberta ontem ou hoje."
          : `A empresa foi aberta há ${idade} dias.`,
    });

  const mei = dados.opcao_pelo_mei === true;
  // MEI não pode ser atacadista na maior parte dos ramos, e o teto de
  // faturamento dele não sustenta uma distribuidora. Não é impossível ser um
  // pequeno fabricante honesto — por isso "atenção", e não "grave".
  if (mei)
    motivos.push({
      peso: "atencao",
      texto: "É MEI. O teto de faturamento do MEI não costuma sustentar uma distribuidora.",
    });

  const capitalNumero =
    dados.capital_social === null || dados.capital_social === undefined
      ? null
      : Number(dados.capital_social);
  const capital = capitalNumero !== null && Number.isFinite(capitalNumero) ? capitalNumero : null;
  // Capital baixo em MEI é o normal; o aviso só vale para quem não é MEI.
  if (!mei && capital !== null && capital < CAPITAL_MINIMO_PLAUSIVEL)
    motivos.push({
      peso: "atencao",
      texto: `O capital social declarado é de R$ ${capital.toLocaleString("pt-BR")}.`,
    });

  if (contatosIguais >= CONTATOS_IGUAIS_SUSPEITOS)
    motivos.push({
      peso: "atencao",
      texto: `O telefone desta empresa aparece em outras ${contatosIguais - 1} empresas na Receita.`,
    });

  return {
    decisao: motivos.length ? "em_analise" : "aprovado",
    motivos,
    abertaEm,
    situacao,
    porte: dados.porte?.trim() || null,
    capital,
    mei,
  };
}

/**
 * Uma data vinda do banco, como "AAAA-MM-DD".
 *
 * O Postgres de produção devolve coluna date como Date; o banco local, como
 * texto. Sem normalizar num lugar só, cada tela trataria um dos dois e
 * quebraria no outro — e só um deles roda nos testes.
 */
export function dataDoBanco(valor: Date | string | null | undefined) {
  if (!valor) return null;
  return (valor instanceof Date ? valor.toISOString() : String(valor)).slice(0, 10);
}

/**
 * Quantos anos inteiros de CNPJ. É o que decide se a idade aparece para o
 * comerciante: só a partir de um ano. "Aberta há 3 meses" ao lado do nome
 * afasta cliente de um fornecedor honesto — a mesma regra que já vale para os
 * outros sinais da vitrine, que só aparecem quando existem de verdade.
 */
export function anosDeEmpresa(abertaEm: string | null, hoje = new Date()) {
  if (!abertaEm) return null;
  const dias = diasEntre(abertaEm, hoje);
  if (dias === null || dias < 0) return null;
  return Math.floor(dias / 365.25);
}

/**
 * O que o comerciante vê ao lado do nome: o que ele consegue conferir por
 * conta própria. "Empresa ativa desde 2020" vale mais que qualquer selo
 * inventado, porque é verificável.
 */
export function tempoDeEmpresa(abertaEm: string | null, hoje = new Date()) {
  if (!abertaEm) return null;
  const dias = diasEntre(abertaEm, hoje);
  if (dias === null || dias < 0) return null;
  const anos = Math.floor(dias / 365.25);
  if (anos >= 1) return anos === 1 ? "há 1 ano" : `há ${anos} anos`;
  const meses = Math.floor(dias / 30.4);
  if (meses >= 1) return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
  return "há menos de um mês";
}
