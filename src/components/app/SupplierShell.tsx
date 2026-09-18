import { Link, useLocation } from "@tanstack/react-router";
import {
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Package,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SemInternet } from "@/components/app/SemInternet";
import { useAuth } from "@/hooks/useAuth";
import { useIdioma } from "@/hooks/useIdioma";
import type { Chave } from "@/lib/idioma";
import { abaDoFornecedor, type AbaFornecedorId } from "@/lib/navegacao";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/app/NotificationCenter";
import { BotaoDeAjuda } from "@/components/app/BotaoDeAjuda";
import {
  BarraInferior,
  useVoltarDeslizando,
  type ItemDaBarra,
} from "@/components/app/NavegacaoMovel";

// O fornecedor tem um painel próprio: ele não vende no PDV, não controla
// estoque de loja e não deve ver nada de margem de comerciante. No celular são
// cinco abas (SPEC §6.2) e o resto mora em "Mais"; no computador a lateral
// mostra tudo, porque há espaço.
const menu = [
  { to: "/fornecedor", chave: "nav.painel", icon: LayoutDashboard },
  { to: "/fornecedor/vitrine", chave: "forn.vitrine", icon: Store },
  { to: "/fornecedor/catalogo", chave: "forn.catalogo", icon: Package },
  { to: "/fornecedor/importar", chave: "forn.importar", icon: FileSpreadsheet },
  { to: "/fornecedor/conversas", chave: "nav.conversas", icon: MessageSquare },
  { to: "/fornecedor/consultor", chave: "forn.consultor", icon: Sparkles },
  { to: "/fornecedor/orcamentos", chave: "nav.orcamentos", icon: FileText },
  { to: "/fornecedor/pedidos", chave: "nav.pedidos", icon: ClipboardList },
  { to: "/fornecedor/financeiro", chave: "forn.contasReceber", icon: Wallet },
  { to: "/fornecedor/configuracoes", chave: "nav.configuracoes", icon: Settings },
  { to: "/assinatura", chave: "nav.plano", icon: CreditCard },
] as const satisfies readonly { to: string; chave: Chave; icon: unknown }[];

const abas = [
  { id: "painel", to: "/fornecedor", chave: "nav.painel", icon: LayoutDashboard },
  { id: "orcamentos", to: "/fornecedor/orcamentos", chave: "nav.orcamentos", icon: FileText },
  { id: "catalogo", to: "/fornecedor/catalogo", chave: "forn.catalogoCurto", icon: Package },
  { id: "conversas", to: "/fornecedor/conversas", chave: "nav.conversas", icon: MessageSquare },
  { id: "mais", to: "/fornecedor/mais", chave: "nav.mais", icon: MoreHorizontal },
] as const satisfies readonly { id: AbaFornecedorId; to: string; chave: Chave; icon: unknown }[];

export function SupplierShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t } = useIdioma();
  const location = useLocation();
  useVoltarDeslizando();

  const isActive = (item: { to: string }) =>
    item.to === "/fornecedor"
      ? location.pathname === "/fornecedor"
      : location.pathname.startsWith(item.to);

  const abaAtual = abaDoFornecedor(location.pathname);
  const barra: ItemDaBarra[] = abas.map((aba) => ({
    to: aba.to,
    label: t(aba.chave),
    icon: aba.icon,
    ativo: aba.id === abaAtual,
  }));

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="hidden w-64 flex-col border-r border-border bg-card lg:static lg:flex">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-bold leading-tight">Central</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {t("forn.rotulo")}
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.chave)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <p className="text-xs font-medium truncate">{user?.companyName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> {t("nav.sair")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:justify-end">
          {/* A navegação mora na barra de baixo; aqui fica a marca, que leva ao
              painel. */}
          <Link to="/fornecedor" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="font-display font-bold">{t("nav.marca")}</span>
          </Link>
          <NotificationCenter />
        </header>
        {/* O espaço de baixo é o da barra MAIS o do botão de ajuda, que flutua
            acima dela: com pb-24 a última linha de cada tela ficava por baixo
            do botão verde. */}
        <SemInternet />
        <main className="flex-1 p-4 pb-36 md:p-8 md:pb-36 lg:pb-8">{children}</main>
      </div>
      <BarraInferior itens={barra} rotulo={t("nav.principal")} />
      {/* O fornecedor também precisa de alguém para chamar. São eles que estão
          chegando agora, e quem trava no cadastro do catálogo desiste calado. */}
      <BotaoDeAjuda />
    </div>
  );
}
