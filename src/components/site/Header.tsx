import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Menu, X, TrendingUp, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/", label: "Início" },
  { to: "/planos", label: "Planos" },
  { to: "/sobre", label: "Sobre" },
  { to: "/contato", label: "Contato" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground shadow-elegant">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span>Central do Comerciante</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Button asChild className="bg-gradient-hero text-primary-foreground shadow-elegant">
              <Link to="/dashboard"><LayoutDashboard className="h-4 w-4 mr-1" /> Ir para o painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
              <Button asChild className="bg-gradient-hero text-primary-foreground shadow-elegant hover:opacity-95">
                <Link to="/cadastro">Teste 14 dias grátis</Link>
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="py-2 text-sm font-medium" onClick={() => setOpen(false)}>{n.label}</Link>
            ))}
            <div className="flex gap-2 pt-2">
              {user ? (
                <Button asChild className="flex-1 bg-gradient-hero text-primary-foreground"><Link to="/dashboard">Painel</Link></Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1"><Link to="/login">Entrar</Link></Button>
                  <Button asChild className="flex-1 bg-gradient-hero text-primary-foreground"><Link to="/cadastro">Cadastrar</Link></Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
