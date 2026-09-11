import { Link, useRouter, type LinkProps } from "@tanstack/react-router";
import { Menu, type LucideIcon } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

// A navegação do app no celular, igual para comerciante e fornecedor.
//
// Até 11/09/2026, no celular, trocar de tela era sempre o mesmo caminho: abrir
// o menu, achar a tela, tocar. Não havia seta de voltar, o menu não fechava
// tocando fora dele, e no app instalado no iPhone não havia jeito nenhum de
// voltar — o iOS não dá o gesto de deslizar para app que veio de site. A Julia
// descreveu assim: entrar num orçamento e ter que clicar nos três pontinhos
// para sair dele.
//
// O modelo é o que todo mundo já sabe usar, do WhatsApp e do Instagram: as
// telas principais numa barra embaixo, ao alcance do polegar; o resto no menu;
// e voltar sempre funciona.

export type ItemDaBarra = {
  // O tipo de rota do próprio roteador: um caminho que não existe não compila.
  to: LinkProps["to"];
  label: string;
  icon: LucideIcon;
  ativo: boolean;
};

/**
 * A barra de baixo, só no celular. Quatro telas e o menu — mais que cinco
 * itens e cada um fica estreito demais para o dedo acertar.
 */
export function BarraInferior({
  itens,
  menuAberto,
  alternarMenu,
}: {
  itens: ItemDaBarra[];
  menuAberto: boolean;
  alternarMenu: () => void;
}) {
  const classe = (ativo: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
      ativo ? "text-primary" : "text-muted-foreground active:text-foreground",
    );
  return (
    <nav
      aria-label="Navegação principal"
      // O recuo de baixo respeita a barrinha do iPhone, que senão cobre os
      // ícones e rouba o toque.
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {itens.map((item) => {
        const Icone = item.icon;
        return (
          <Link key={item.label} to={item.to} className={classe(item.ativo && !menuAberto)}>
            <Icone className="h-5 w-5" />
            <span className="leading-tight">{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={alternarMenu}
        aria-expanded={menuAberto}
        className={classe(menuAberto)}
      >
        <Menu className="h-5 w-5" />
        <span className="leading-tight">Menu</span>
      </button>
    </nav>
  );
}

/**
 * O fundo escuro atrás do menu aberto. Tocar nele fecha — é o que qualquer
 * pessoa tenta primeiro, e antes não acontecia nada.
 */
export function FundoDoMenu({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  if (!aberto) return null;
  return (
    <div
      aria-hidden
      onClick={fechar}
      className="fixed inset-0 z-[35] bg-foreground/30 backdrop-blur-[1px] lg:hidden"
    />
  );
}

/**
 * Deslizar da borda esquerda para voltar, no app instalado no iPhone.
 *
 * Só ali. No Safari o próprio iOS já faz esse gesto, e no Android o sistema tem
 * o voltar dele — ligar isto nesses lugares voltaria duas telas de uma vez.
 */
export function useVoltarDeslizando() {
  const router = useRouter();
  useEffect(() => {
    const instaladoNoIphone = (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!instaladoNoIphone) return;

    let inicio: { x: number; y: number; quando: number } | null = null;
    const tocou = (evento: TouchEvent) => {
      const toque = evento.touches[0];
      // Só vale começando rente à borda: no meio da tela, arrastar para o lado
      // é rolar uma tabela, e não pedir para sair dela.
      inicio =
        toque && toque.clientX < 24
          ? { x: toque.clientX, y: toque.clientY, quando: Date.now() }
          : null;
    };
    const soltou = (evento: TouchEvent) => {
      const toque = evento.changedTouches[0];
      if (!inicio || !toque) return;
      const paraOLado = toque.clientX - inicio.x;
      const paraCima = Math.abs(toque.clientY - inicio.y);
      if (paraOLado > 80 && paraCima < 60 && Date.now() - inicio.quando < 700)
        router.history.back();
      inicio = null;
    };
    window.addEventListener("touchstart", tocou, { passive: true });
    window.addEventListener("touchend", soltou, { passive: true });
    return () => {
      window.removeEventListener("touchstart", tocou);
      window.removeEventListener("touchend", soltou);
    };
  }, [router]);
}
