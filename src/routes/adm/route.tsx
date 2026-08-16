import { Link, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CreditCard,
  LogOut,
  Menu,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getStaffUser, staffLogout } from "@/lib/api/staff.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/adm")({
  ssr: false,
  component: AdminLayout,
});

const menu = [
  { to: "/adm", label: "Visão geral", icon: BarChart3 },
  { to: "/adm/clientes", label: "Clientes", icon: Users },
  { to: "/adm/cobranca", label: "Cobrança", icon: CreditCard },
  { to: "/adm/fornecedores", label: "Fornecedores procurados", icon: PhoneCall },
  { to: "/adm/auditoria", label: "Auditoria", icon: ScrollText },
  { to: "/adm/equipe", label: "Equipe", icon: UserCog },
] as const;

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => getStaffUser(),
    retry: false,
  });

  // O login do back office é uma tela separada, com sessão separada. Nenhuma
  // conta de cliente alcança esta área.
  if (location.pathname === "/adm/login") return <Outlet />;

  if (isLoading)
    return <div className="min-h-screen grid place-items-center text-sm">Carregando...</div>;

  if (!staff)
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Área restrita.</p>
          <Button asChild className="mt-4">
            <Link to="/adm/login">Entrar no back office</Link>
          </Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* No celular o menu vira gaveta: sem isto, quem abre uma tela pelo
          telefone fica preso nela, sem caminho de volta nem para sair. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-border bg-card transition-transform lg:static lg:flex lg:translate-x-0",
          open ? "flex translate-x-0" : "hidden lg:flex -translate-x-full lg:translate-x-0",
        )}
        onClick={() => setOpen(false)}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="font-display font-bold leading-tight">Central</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Back office</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/adm"
                ? location.pathname === "/adm"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
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
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <p className="text-xs font-medium truncate">{staff.name}</p>
            <p className="text-xs text-muted-foreground truncate">{staff.role}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await staffLogout();
              queryClient.clear();
              navigate({ to: "/adm/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center gap-3 px-4 lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">Back office</span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
