import { Link, useLocation } from "@tanstack/react-router";
import {
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Sparkles,
  Store,
  TrendingUp,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// O fornecedor tem um painel próprio: ele não vende no PDV, não controla
// estoque de loja e não deve ver nada de margem de comerciante. Conforme as
// telas de catálogo, vitrine, pedidos e conversas forem ficando prontas,
// entram aqui.
const menu = [
  { to: "/fornecedor", label: "Painel", icon: LayoutDashboard },
  { to: "/fornecedor/vitrine", label: "Minha vitrine", icon: Store },
  { to: "/fornecedor/catalogo", label: "Meu catálogo", icon: Package },
  { to: "/fornecedor/importar", label: "Importar planilha", icon: FileSpreadsheet },
  { to: "/fornecedor/conversas", label: "Conversas", icon: MessageSquare },
  { to: "/fornecedor/consultor", label: "Consultor de Vendas", icon: Sparkles },
  { to: "/fornecedor/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/fornecedor/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/assinatura", label: "Plano e assinatura", icon: CreditCard },
] as const;

type MenuItem = (typeof menu)[number];

export function SupplierShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const isActive = (item: MenuItem) =>
    item.to === "/fornecedor"
      ? location.pathname === "/fornecedor"
      : location.pathname.startsWith(item.to);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex-col transition-transform lg:static lg:translate-x-0 lg:flex",
          open ? "flex translate-x-0" : "hidden lg:flex -translate-x-full lg:translate-x-0",
        )}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-bold leading-tight">Central</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Fornecedor</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
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
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="font-display font-bold">Central do Comerciante</div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
