import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { brl, num } from "@/lib/format";
import { TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Central do Comerciante" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const trintaDias = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [vendas, produtos, baixoEstoque] = await Promise.all([
        supabase.from("vendas").select("total, custo_total, lucro, data_venda").gte("data_venda", trintaDias),
        supabase.from("produtos").select("id, nome, estoque_atual, estoque_minimo, preco_venda, preco_custo").eq("ativo", true),
        supabase.from("produtos").select("id, nome, estoque_atual, estoque_minimo").eq("ativo", true),
      ]);
      const vv = vendas.data ?? [];
      const pp = produtos.data ?? [];
      const faturamento = vv.reduce((s, v) => s + Number(v.total ?? 0), 0);
      const lucro = vv.reduce((s, v) => s + Number(v.lucro ?? 0), 0);
      const custo = vv.reduce((s, v) => s + Number(v.custo_total ?? 0), 0);
      const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;
      const valorEstoque = pp.reduce((s, p) => s + Number(p.preco_custo ?? 0) * Number(p.estoque_atual ?? 0), 0);
      const alertas = (baixoEstoque.data ?? []).filter(
        (p) => Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0
      );
      const saude = Math.min(100, Math.round(margem * 3 + (alertas.length === 0 ? 20 : 0) + (vv.length > 0 ? 20 : 0)));
      return { faturamento, lucro, custo, margem, valorEstoque, alertas, totalVendas: vv.length, totalProdutos: pp.length, saude };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Olá, comerciante! 👋</h1>
        <p className="text-muted-foreground mt-1">Aqui está o resumo dos últimos 30 dias — {user?.email}</p>
      </div>

      {/* Índice de Saúde do Lucro */}
      <Card className="p-6 bg-gradient-hero text-primary-foreground shadow-elegant">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm opacity-90">Índice de Saúde do Lucro</p>
            <p className="text-5xl font-bold mt-1">{isLoading ? "—" : data?.saude ?? 0}<span className="text-2xl opacity-70">/100</span></p>
            <p className="text-sm opacity-90 mt-2">
              {(data?.saude ?? 0) >= 70 ? "Seu comércio está saudável 🎉" : (data?.saude ?? 0) >= 40 ? "Atenção: há espaço para melhorar" : "Vamos identificar onde você está perdendo dinheiro"}
            </p>
          </div>
          <TrendingUp className="h-16 w-16 opacity-80" />
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Faturamento (30d)" value={brl(data?.faturamento ?? 0)} icon={DollarSign} tone="primary" />
        <Kpi label="Lucro (30d)" value={brl(data?.lucro ?? 0)} icon={TrendingUp} tone="success" sub={`Margem ${num(data?.margem ?? 0, 1)}%`} />
        <Kpi label="Vendas realizadas" value={num(data?.totalVendas ?? 0)} icon={ShoppingCart} />
        <Kpi label="Valor em estoque" value={brl(data?.valorEstoque ?? 0)} icon={Package} sub={`${data?.totalProdutos ?? 0} produtos ativos`} />
      </div>

      {/* Alertas */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h2 className="font-semibold text-lg">Alertas de estoque baixo</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (data?.alertas.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta no momento. Todos os produtos estão com estoque acima do mínimo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data!.alertas.slice(0, 8).map((p) => (
              <li key={p.id} className="py-3 flex justify-between items-center">
                <span className="font-medium">{p.nome}</span>
                <span className="text-sm text-warning font-medium">
                  {num(Number(p.estoque_atual), 0)} un (mín: {num(Number(p.estoque_minimo), 0)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, sub, tone }: { label: string; value: string; icon: any; sub?: string; tone?: "primary" | "success" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone === "success" ? "text-success" : tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}
