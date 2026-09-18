import { Link } from "@tanstack/react-router";
import { ChevronRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useIdioma } from "@/hooks/useIdioma";
import type { Chave } from "@/lib/idioma";

type Item = { to: string; chave: Chave; grupo: string };
type Grupo = { id: string; titulo: Chave };

/**
 * A quinta aba, dos dois lados: reúne o que não é de todo dia. No computador
 * esses itens já estão à vista na lateral; a tela existe para o celular, que
 * não tem lateral.
 */
export function TelaMais({ itens, grupos }: { itens: readonly Item[]; grupos: readonly Grupo[] }) {
  const { user, signOut } = useAuth();
  const { t } = useIdioma();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t("mais.titulo")}</h1>
        <p className="text-muted-foreground">
          {user?.companyName}
          {user?.email ? ` · ${user.email}` : ""}
        </p>
      </div>
      {grupos.map((grupo) => (
        <section key={grupo.id} className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {t(grupo.titulo)}
          </h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {itens
              .filter((item) => item.grupo === grupo.id)
              .map((item) => (
                <Link
                  key={item.to}
                  // O caminho vem de uma lista `as const` validada pelo roteador
                  // onde ela é declarada; aqui ele chega como texto.
                  to={item.to as "/"}
                  className="flex items-center justify-between px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
                >
                  {t(item.chave)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
          </Card>
        </section>
      ))}
      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> {t("nav.sair")}
      </Button>
    </div>
  );
}
