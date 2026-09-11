import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

// O item aberto — o orçamento, a conversa — mora no endereço da página.
//
// Antes ele morava só na memória da tela. Abrir um orçamento trocava a lista
// pelo detalhe sem mudar o endereço, e para o celular nada tinha acontecido: o
// gesto de voltar não fechava o orçamento, tirava a pessoa da tela inteira. No
// app instalado no iPhone, que não tem botão de voltar, o jeito era abrir o
// menu e escolher outra tela. O WhatsApp e o Instagram ensinaram todo mundo o
// contrário: voltar fecha a conversa e mostra a lista.
//
// Com o item no endereço, abrir cria um passo no histórico, e qualquer forma
// de voltar — gesto, botão do Android, seta do navegador, o "Voltar" da própria
// tela — desfaz esse passo. E um link direto para um orçamento passa a abrir o
// orçamento, e não a lista.

/** O que a rota aceita no endereço: `?aberto=<id>`, e nada além disso. */
export function buscaDoItemAberto(busca: Record<string, unknown>): { aberto?: string } {
  // Devolver {} quando não há item, e não { aberto: undefined }: com a chave
  // presente o roteador passa a exigir `search` em todo link para esta tela.
  return typeof busca.aberto === "string" && /^[0-9a-f-]{36}$/i.test(busca.aberto)
    ? { aberto: busca.aberto }
    : {};
}

export type ItemAberto = {
  aberto: string | null;
  abrir: (id: string) => void;
  fechar: () => void;
};

export function useItemAberto(
  aberto: string | undefined,
  irPara: (aberto: string | undefined, substituir: boolean) => void,
): ItemAberto {
  const router = useRouter();
  // Se foi esta tela que abriu o item, fechar é voltar um passo — o mesmo que
  // o gesto faria. Se a pessoa chegou por um link direto, não há passo para
  // trás dentro do app, e voltar a tiraria da Central: aí o item é trocado
  // pela lista no mesmo lugar.
  const abriuNestaTela = useRef(false);
  useEffect(() => {
    if (!aberto) abriuNestaTela.current = false;
  }, [aberto]);

  return {
    aberto: aberto ?? null,
    abrir(id) {
      if (id === aberto) return;
      // Pular de uma conversa aberta para outra substitui em vez de empilhar.
      // Senão o voltar percorre cada conversa vista antes de chegar na lista.
      const substituir = Boolean(aberto);
      if (!substituir) abriuNestaTela.current = true;
      irPara(id, substituir);
    },
    fechar() {
      if (abriuNestaTela.current) {
        abriuNestaTela.current = false;
        router.history.back();
      } else {
        irPara(undefined, true);
      }
    },
  };
}
