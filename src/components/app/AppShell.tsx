import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  Truck,
  ShoppingCart,
  Sparkles,
  Settings,
  LogOut,
  TrendingUp,
  Menu,
  X,
  BarChart3,
  Users,
  CreditCard,
  Plug,
  Search,
  MessageSquare,
  ClipboardList,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/app/NotificationCenter";

// A Central é uma camada de inteligência, não mais um sistema para digitar
// tudo de novo. Conectar o sistema que o comerciante já usa vem primeiro; o
// lançamento manual continua disponível, mas como apoio.
const menu = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/comprar", label: "Onde comprar", icon: Search },
  { to: "/conversas", label: "Conversas", icon: MessageSquare },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/integracoes", label: "Conectar meu sistema", icon: Plug },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/consultor", label: "Assistente de Lucro", icon: Sparkles },
] as const;

const manualMenu = [
  { to: "/pdv", label: "Registrar venda", icon: ShoppingCart },
  { to: "/vendas", label: "Histórico de vendas", icon: TrendingUp },
] as const;

const accountMenu = [
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/assinatura", label: "Plano e assinatura", icon: CreditCard },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

// Deriva do próprio catálogo para manter os caminhos como literais: o Link do
// TanStack valida a rota em tempo de compilação e `string` quebraria isso.
type MenuItem = (typeof menu)[number] | (typeof manualMenu)[number] | (typeof accountMenu)[number];

function NavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: MenuItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
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
          <div className="font-display font-bold">Central</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menu.map((m) => (
            <NavItem key={m.to} item={m} pathname={location.pathname} onNavigate={close} />
          ))}
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Lançamento manual
          </p>
          {manualMenu.map((m) => (
            <NavItem key={m.to} item={m} pathname={location.pathname} onNavigate={close} />
          ))}
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Conta
          </p>
          {accountMenu.map((m) => (
            <NavItem key={m.to} item={m} pathname={location.pathname} onNavigate={close} />
          ))}
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

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:justify-end">
          <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="font-display font-bold lg:hidden">Central do Comerciante</div>
          <NotificationCenter />
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
