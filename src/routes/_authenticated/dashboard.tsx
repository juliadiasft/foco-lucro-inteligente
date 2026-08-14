import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  PackageX,
  Plug,
  Plus,
  ShoppingCart,
  Target,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDashboard } from "@/lib/api/dashboard.functions";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Central do Comerciante" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const missing = Math.max(0, (data?.goal || 0) - (data?.month.revenue || 0));
  const scoreTone =
    (data?.healthScore || 0) >= 75
      ? "text-success"
      : (data?.healthScore || 0) >= 50
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Olá, {data?.companyName || "comerciante"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Veja a saúde financeira e operacional do negócio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link to="/integracoes">
              <Plug className="h-4 w-4 mr-1" /> Conectar meu sistema
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pdv">
              <Plus className="h-4 w-4 mr-1" /> Registrar venda
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={ShoppingCart}
          label="Vendas hoje"
          value={isLoading ? "—" : brl(data?.today.revenue)}
          detail={`${data?.today.count || 0} venda(s)`}
        />
        <Metric
          icon={TrendingUp}
          label="Faturamento no mês"
          value={isLoading ? "—" : brl(data?.month.revenue)}
          detail={`Lucro ${brl(data?.month.profit)}`}
        />
        <Metric
          icon={Target}
          label="Ticket médio"
          value={isLoading ? "—" : brl(data?.month.ticket)}
          detail={`${data?.month.count || 0} venda(s) no mês`}
        />
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Índice de saúde</h2>
          </div>
          <p className={`text-4xl font-bold mt-3 ${scoreTone}`}>
            {isLoading ? "—" : `${data?.healthScore}/100`}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Calculado com vendas, margem, meta, estoque e cotações.
          </p>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" />
            <h2 className="text-sm font-semibold uppercase">Meta do mês</h2>
          </div>
          {!data?.goal ? (
            <div className="mt-4">
              <p className="font-medium">Defina uma meta para acompanhar o progresso.</p>
              <Link to="/configuracoes" className="text-sm text-primary underline">
                Abrir configurações
              </Link>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold mt-3">
                {brl(data.month.revenue)}{" "}
                <span className="text-base text-muted-foreground font-normal">
                  de {brl(data.goal)}
                </span>
              </p>
              <Progress value={data.goalProgress} className="h-4 mt-4" />
              <div className="flex justify-between text-sm mt-2">
                <span className="font-semibold text-primary">{Math.round(data.goalProgress)}%</span>
                <span className="text-muted-foreground">Faltam {brl(missing)}</span>
              </div>
            </>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Rentabilidade do mês</h2>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground">Lucro estimado</p>
              <p className="text-2xl font-bold text-success">{brl(data?.month.profit)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Margem</p>
              <p className="text-2xl font-bold">{num(data?.month.margin, 1)}%</p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/relatorios">Ver relatório completo</Link>
          </Button>
        </Card>
      </div>
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold">Produtos para repor</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Itens no mínimo configurado ou abaixo dele.
        </p>
        {!data?.lowStock.length ? (
          <div className="flex gap-3 rounded-lg bg-success/10 border border-success/30 p-4">
            <PackageX className="h-5 w-5 text-success" />
            <p className="text-sm">
              <strong className="text-success">Tudo certo.</strong> Nenhum produto com estoque
              baixo.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {data.lowStock.map((product) => (
              <li key={product.id} className="py-3 flex justify-between">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Mínimo: {product.minimumStock || 5} {product.unit}
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-warning/15 text-warning">
                  {product.stock} {product.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-5 w-5" />
        <h2 className="text-xs font-semibold uppercase">{label}</h2>
      </div>
      <p className="text-3xl font-bold mt-3">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{detail}</p>
    </Card>
  );
}
