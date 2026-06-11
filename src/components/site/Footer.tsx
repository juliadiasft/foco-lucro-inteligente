import { Link } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            Central do Comerciante
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            O sistema inteligente que mostra onde você perde dinheiro e como lucrar mais.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Produto</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/planos" className="hover:text-foreground">Planos</Link></li>
            <li><Link to="/" hash="recursos" className="hover:text-foreground">Recursos</Link></li>
            <li><Link to="/" hash="ia" className="hover:text-foreground">Consultor de Lucro IA</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Empresa</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/sobre" className="hover:text-foreground">Sobre</Link></li>
            <li><Link to="/contato" className="hover:text-foreground">Contato</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3">Conta</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-foreground">Entrar</Link></li>
            <li><Link to="/cadastro" className="hover:text-foreground">Criar conta</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container mx-auto px-4 py-5 text-xs text-muted-foreground flex flex-col md:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} Central do Comerciante. Todos os direitos reservados.</span>
          <span>Feito no Brasil 🇧🇷</span>
        </div>
      </div>
    </footer>
  );
}
