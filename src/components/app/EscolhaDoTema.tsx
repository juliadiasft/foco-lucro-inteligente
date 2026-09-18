import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import {
  CHAVE_DO_TEMA,
  EXPLICACAO_DO_TEMA,
  NOME_DO_TEMA,
  TEMAS,
  TEMA_PADRAO,
  ehTema,
  ficaEscuro,
  type Tema,
} from "@/lib/tema";
import { cn } from "@/lib/utils";

const ICONE: Record<Tema, typeof Sun> = {
  sistema: Monitor,
  claro: Sun,
  escuro: Moon,
};

/**
 * A escolha do tema.
 *
 * A troca acontece na hora, sem salvar nem recarregar: quem está decidindo
 * entre claro e escuro quer ver a diferença, não confirmar um formulário.
 */
export function EscolhaDoTema() {
  const [tema, setTema] = useState<Tema>(TEMA_PADRAO);

  // O valor guardado só é lido depois que a tela monta. Ler durante o render
  // quebraria o servidor, que não tem localStorage — e o script do <head> já
  // pintou a tela certa antes disso, então não há piscada aqui.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CHAVE_DO_TEMA);
      if (ehTema(guardado)) setTema(guardado);
    } catch {
      // Navegador com armazenamento bloqueado: fica no padrão do sistema.
    }
  }, []);

  const aplicar = (novo: Tema) => {
    setTema(novo);
    try {
      localStorage.setItem(CHAVE_DO_TEMA, novo);
    } catch {
      // Sem guardar, a escolha vale só nesta sessão. Melhor que não funcionar.
    }
    const escuro = ficaEscuro(novo, window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", escuro);
    document.documentElement.style.colorScheme = escuro ? "dark" : "light";
  };

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Aparência</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escuro cansa menos a vista no estoque ou de noite. A escolha vale só neste aparelho.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tema do app">
        {TEMAS.map((opcao) => {
          const Icone = ICONE[opcao];
          const escolhido = tema === opcao;
          return (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={escolhido}
              onClick={() => aplicar(opcao)}
              // min-h-11: o alvo de toque mínimo. Um botão de 32px de altura é
              // o tipo de coisa que funciona no mouse e falha no dedo.
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                escolhido
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted focus-visible:bg-muted",
              )}
            >
              <Icone
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 shrink-0",
                  escolhido ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{NOME_DO_TEMA[opcao]}</span>
                <span className="block text-xs text-muted-foreground">
                  {EXPLICACAO_DO_TEMA[opcao]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
