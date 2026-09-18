import { Languages } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useIdioma } from "@/hooks/useIdioma";
import { IDIOMAS, NOME_DO_IDIOMA } from "@/lib/idioma";
import { cn } from "@/lib/utils";

/**
 * A escolha do idioma. Como o tema, troca na hora e vale só neste aparelho.
 * Cada idioma aparece com o próprio nome: quem caiu numa tela que não entende
 * precisa achar o dele sem ler o da tela.
 */
export function EscolhaDoIdioma() {
  const { idioma, t, escolherIdioma } = useIdioma();
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Languages aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        {t("cfg.idiomaTitulo")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("cfg.idiomaAjuda")}</p>
      <div
        className="mt-4 grid gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label={t("cfg.idiomaTitulo")}
      >
        {IDIOMAS.map((opcao) => {
          const escolhido = idioma === opcao;
          return (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={escolhido}
              lang={opcao}
              onClick={() => escolherIdioma(opcao)}
              className={cn(
                "flex min-h-11 items-center rounded-lg border p-3 text-left text-sm font-medium transition-colors",
                escolhido
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted focus-visible:bg-muted",
              )}
            >
              {NOME_DO_IDIOMA[opcao]}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
