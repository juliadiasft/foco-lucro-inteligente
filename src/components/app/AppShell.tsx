import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  Search,
  Sparkles,
  LogOut,
  MoreHorizontal,
  TrendingUp,
  Lock,
} from "lucide-react";
import { SemInternet } from "@/components/app/SemInternet";
import { useAuth } from "@/hooks/useAuth";
import { diasRestantes, naRetaFinal, tituloDoFim } from "@/lib/fim-do-teste";
import { useIdioma } from "@/hooks/useIdioma";
import type { Chave } from "@/lib/idioma";
import { Button } from "@/components/ui/button";
import { planIncludes, type PlanFeature } from "@/lib/plans";
import { cn } from "@/lib/utils";
import {
  ITENS_DE_MAIS,
  SUBTELAS_DE_COMPRAR,
  abaDaRota,
  mostraSubtelasDeComprar,
  subtelaAtiva,
  type AbaId,
} from "@/lib/navegacao";
import { NotificationCenter } from "@/components/app/NotificationCenter";
import { BotaoDeAjuda } from "@/components/app/BotaoDeAjuda";
import {
  BarraInferior,
  useVoltarDeslizando,
  type ItemDaBarra,
} from "@/components/app/NavegacaoMovel";

// As cinco abas do app (SPEC §6.1). A Central é uma camada de inteligência, não
// mais um sistema para digitar tudo de novo: o que o comerciante usa todo dia
// está nas quatro primeiras, e o resto — inclusive o lançamento manual — mora
// em "Mais". A gaveta de 11 itens saiu.
//
// `feature` mantém o cadeado: o item bloqueado continua visível. Sumir
// esconderia o motivo de trocar de plano de quem já experimentou no teste de 7
// dias.
const abas: {
  id: AbaId;
  to: "/dashboard" | "/comprar" | "/produtos" | "/consultor" | "/mais";
  chave: Chave;
  // Na barra de baixo cada rótulo tem de caber em um quinto da tela.
  chaveCurta: Chave;
  icon: typeof LayoutDashboard;
  feature?: PlanFeature;
}[] = [
  {
    id: "painel",
    to: "/dashboard",
    chave: "nav.painel",
    chaveCurta: "nav.painel",
    icon: LayoutDashboard,
  },
  {
    id: "comprar",
    to: "/comprar",
    chave: "nav.comprar",
    chaveCurta: "nav.comprar",
    icon: Search,
    feature: "comparacaoFornecedores",
  },
  {
    id: "produtos",
    to: "/produtos",
    chave: "nav.produtos",
    chaveCurta: "nav.produtos",
    icon: Package,
  },
  {
    id: "assistente",
    to: "/consultor",
    chave: "nav.assistenteLongo",
    chaveCurta: "nav.assistente",
    icon: Sparkles,
    feature: "consultorIa",
  },
  { id: "mais", to: "/mais", chave: "nav.mais", chaveCurta: "nav.mais", icon: MoreHorizontal },
];

const classeDoItem = (ativo: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    ativo
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:text-foreground hover:bg-muted",
  );

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t } = useIdioma();
  const location = useLocation();
  const pathname = location.pathname;
  const abaAtual = abaDaRota(pathname);
  // Só depois de montar: os dias dependem do relógio do navegador.
  const [diasDoTeste, setDiasDoTeste] = useState<number | null>(null);
  useEffect(() => {
    if (user) setDiasDoTeste(diasRestantes(user.trialEndsAt, new Date()));
  }, [user]);

  const barra: ItemDaBarra[] = abas.map((aba) => ({
    to: aba.to,
    label: t(aba.chaveCurta),
    icon: aba.icon,
    ativo: aba.id === abaAtual,
  }));

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar — só no computador. No celular a navegação é a barra de baixo. */}
      <aside className="hidden w-64 flex-col border-r border-border bg-card lg:static lg:flex">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="font-display font-bold">Central</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {abas
            .filter((aba) => aba.id !== "mais")
            .map((aba) => {
              const Icon = aba.icon;
              const bloqueado = Boolean(
                aba.feature && user?.plan && !planIncludes(user.plan, aba.feature),
              );
              return (
                <Link key={aba.id} to={aba.to} className={classeDoItem(aba.id === abaAtual)}>
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{t(aba.chave)}</span>
                  {bloqueado && <Lock className="h-3.5 w-3.5 opacity-60" />}
                </Link>
              );
            })}
          {/* Computador tem espaço: o conteúdo de "Mais" fica à vista, em vez de
              uma tela a mais entre a pessoa e Contas a pagar. */}
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {t("nav.mais")}
          </p>
          {ITENS_DE_MAIS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={classeDoItem(subtelaAtiva(pathname, item.to))}
            >
              <span className="flex-1">{t(item.chave)}</span>
            </Link>
          ))}
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

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:justify-end">
          {/* No celular a marca fica em cima e leva ao painel; a navegação mora
              na barra de baixo, junto do polegar. */}
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="font-display font-bold">{t("nav.marca")}</span>
          </Link>
          <NotificationCenter />
        </header>
        {mostraSubtelasDeComprar(pathname) && (
          // Comprar absorve buscar, orçar, negociar e pedir. Rola de lado no
          // celular: cinco rótulos não cabem lado a lado em 375px.
          <nav
            aria-label={t("nav.comprar")}
            className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden"
          >
            {SUBTELAS_DE_COMPRAR.map((subtela) => (
              <Link
                key={subtela.to}
                to={subtela.to}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  subtelaAtiva(pathname, subtela.to)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(subtela.chave)}
              </Link>
            ))}
          </nav>
        )}
        {/* O espaço de baixo no celular é o da barra MAIS o do botão de ajuda,
            que flutua acima dela: com pb-24 a última linha de cada tela ficava
            por baixo do botão verde — no Painel, a data da atualização. */}
        {user &&
          diasDoTeste !== null &&
          naRetaFinal(user.subscriptionStatus, diasDoTeste) &&
          pathname !== "/assinatura" && (
            <Link
              to="/assinatura"
              className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2.5 text-sm md:mx-8"
            >
              <span className="font-semibold">{tituloDoFim(diasDoTeste)}</span>
              <span className="text-primary font-semibold whitespace-nowrap">
                Ver o que a Central achou
              </span>
            </Link>
          )}
        <SemInternet />
        <main className="flex-1 p-4 pb-36 md:p-8 md:pb-36 lg:pb-8">{children}</main>
      </div>
      <BarraInferior itens={barra} rotulo={t("nav.principal")} />
      {/* Fica no shell, e não em cada tela: quem se perde pode estar em
          qualquer uma delas, e o canto de baixo à direita é onde a pessoa já
          procura ajuda por hábito de outros sistemas. */}
      <BotaoDeAjuda />
    </div>
  );
}
