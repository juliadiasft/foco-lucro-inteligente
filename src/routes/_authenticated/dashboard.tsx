import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/format";
import { ShoppingCart, Target, AlertTriangle, PackageX, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Central do Comerciante" }] }),
  component: Dashboard,
});

const ESTOQUE_MIN_PADRAO = 5;

function inicioDoDia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["painel-resumo"],
    queryFn: async () => {
      const [hoje, mes, produtos, empresa] = await Promise.all([
        supabase.from("vendas").select("total").gte("data_venda", inicioDoDia()),
        supabase.from("vendas").select("total").gte("data_venda", inicioDoMes()),
        supabase
          .from("produtos")
          .select("id, nome, estoque_atual, estoque_minimo, unidade")
          .eq("ativo", true),
        supabase.from("empresas").select("nome, meta_faturamento_mensal").maybeSingle(),
      ]);

      const vh = hoje.data ?? [];
      const vm = mes.data ?? [];
      const pp = produtos.data ?? [];

      const vendasHojeQtd = vh.length;
      const vendasHojeTotal = vh.reduce((s, v) => s + Number(v.total ?? 0), 0);
      const vendidoMes = vm.reduce((s, v) => s + Number(v.total ?? 0), 0);
      const meta = Number(empresa.data?.meta_faturamento_mensal ?? 0);
      const progressoMeta = meta > 0 ? Math.min(100, (vendidoMes / meta) * 100) : 0;

      const baixos = pp
        .filter((p) => {
          const min = Number(p.estoque_minimo) > 0 ? Number(p.estoque_minimo) : ESTOQUE_MIN_PADRAO;
          return Number(p.estoque_atual) <= min;
        })
        .sort((a, b) => Number(a.estoque_atual) - Number(b.estoque_atual));

      return {
        nomeEmpresa: empresa.data?.nome ?? "",
        vendasHojeQtd,
        vendasHojeTotal,
        vendidoMes,
        meta,
        progressoMeta,
        baixos,
      };
    },
  });

  const nome = data?.nomeEmpresa || user?.email?.split("@")[0] || "comerciante";
  const faltamMeta = Math.max(0, (data?.meta ?? 0) - (data?.vendidoMes ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Olá, {nome}! 👋</h1>
          <p className="text-muted-foreground mt-1">Um resumo rápido de como vai o seu comércio hoje.</p>
        </div>
        <Button asChild size="lg" className="bg-gradient-hero text-primary-foreground">
          <Link to="/pdv"><Plus className="h-4 w-4 mr-1" /> Registrar venda</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Vendas de hoje */}
        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-2 text-primary">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Vendas de hoje</h2>
          </div>
          <p className="text-5xl md:text-6xl font-bold mt-3 text-foreground">
            {isLoading ? "—" : brl(data?.vendasHojeTotal ?? 0)}
          </p>
          <p className="text-muted-foreground mt-2 text-base">
            {isLoading
              ? "Carregando..."
              : (data?.vendasHojeQtd ?? 0) === 0
                ? "Nenhuma venda registrada ainda hoje."
                : `${data?.vendasHojeQtd} ${data?.vendasHojeQtd === 1 ? "venda registrada" : "vendas registradas"} até agora.`}
          </p>
        </Card>

        {/* Meta do mês */}
        <Card className="p-6 shadow-elegant">
          <div className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Meta do mês</h2>
          </div>

          {(data?.meta ?? 0) === 0 ? (
            <div className="mt-3">
              <p className="text-lg font-medium">Você ainda não definiu uma meta.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Defina a meta de faturamento em <Link to="/configuracoes" className="text-primary underline">Configurações</Link> para acompanhar seu progresso.
              </p>
            </div>
          ) : (
            <>
              <p className="text-4xl md:text-5xl font-bold mt-3">
                {brl(data?.vendidoMes ?? 0)}
                <span className="text-lg text-muted-foreground font-normal"> de {brl(data?.meta ?? 0)}</span>
              </p>
              <div className="mt-4">
                <Progress value={data?.progressoMeta ?? 0} className="h-4" />
                <div className="flex justify-between mt-2 text-sm">
                  <span className="font-semibold text-primary">{Math.round(data?.progressoMeta ?? 0)}% da meta</span>
                  <span className="text-muted-foreground">Faltam {brl(faltamMeta)}</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Estoque baixo */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold">Precisa repor no estoque</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Produtos com {ESTOQUE_MIN_PADRAO} unidades ou menos (ou abaixo do mínimo que você definiu).
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (data?.baixos.length ?? 0) === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-success/10 border border-success/30 p-4">
            <PackageX className="h-5 w-5 text-success" />
            <p className="text-sm">
              <span className="font-semibold text-success">Tudo certo!</span>{" "}
              <span className="text-muted-foreground">Nenhum produto está com estoque baixo.</span>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data!.baixos.slice(0, 10).map((p) => {
              const atual = Number(p.estoque_atual);
              const critico = atual <= 0;
              return (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {critico ? "Sem estoque — venda travada" : "Estoque abaixo do recomendado"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${
                      critico
                        ? "bg-destructive/15 text-destructive"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {atual} {p.unidade}
                  </span>
                </li>
              );
            })}
            {(data?.baixos.length ?? 0) > 10 && (
              <li className="pt-3 text-sm text-muted-foreground">
                E mais {(data?.baixos.length ?? 0) - 10} produtos. Veja todos em{" "}
                <Link to="/produtos" className="text-primary underline">Produtos</Link>.
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
