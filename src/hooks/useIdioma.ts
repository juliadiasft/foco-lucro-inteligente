import { useCallback, useSyncExternalStore } from "react";

import {
  CHAVE_DO_IDIOMA,
  IDIOMA_PADRAO,
  LANG_HTML,
  ehIdioma,
  traduzir,
  type Chave,
  type Idioma,
} from "@/lib/idioma";

// O idioma é lido do localStorage e vive num pequeno repositório fora do React:
// assim a troca em Configurações atualiza o menu, a barra de baixo e a tela
// aberta no mesmo instante, sem provedor no topo da árvore.
//
// useSyncExternalStore devolve o `getServerSnapshot` durante a hidratação, então
// o servidor (que não sabe a escolha) e o primeiro render do navegador batem —
// e só depois a tela troca para o idioma guardado.

let atual: Idioma | null = null;
const ouvintes = new Set<() => void>();

function lerGuardado(): Idioma {
  try {
    const guardado = localStorage.getItem(CHAVE_DO_IDIOMA);
    if (ehIdioma(guardado)) return guardado;
  } catch {
    // Armazenamento bloqueado: fica no padrão.
  }
  return IDIOMA_PADRAO;
}

function snapshot(): Idioma {
  if (atual === null) atual = lerGuardado();
  return atual;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function escolherIdioma(novo: Idioma) {
  atual = novo;
  try {
    localStorage.setItem(CHAVE_DO_IDIOMA, novo);
  } catch {
    // Sem guardar, a escolha vale só nesta sessão. Melhor que não funcionar.
  }
  document.documentElement.lang = LANG_HTML[novo];
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function useIdioma() {
  const idioma = useSyncExternalStore(assinar, snapshot, () => IDIOMA_PADRAO);
  const t = useCallback((chave: Chave) => traduzir(idioma, chave), [idioma]);
  return { idioma, t, escolherIdioma };
}
