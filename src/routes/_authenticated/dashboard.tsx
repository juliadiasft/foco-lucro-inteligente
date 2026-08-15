import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Clock,
  Handshake,
  Info,
  Package,
  PackageX,
  PiggyBank,
  Plug,
  Plus,
  Target,
  TrendingDown,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InsightsPanel } from "@/components/app/InsightsPanel";
import { getDashboard, type AttentionItem } from "@/lib/api/dashboard.functions";
import { getPurchaseInsights } from "@/lib/api/insights.functions";
import { baseUnitShort } from "@/lib/catalog";
import { brl, dataHoraBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Central do Comerciante" }] }),
  component: DashboardPage,
});

const attentionStyles: Record<AttentionItem["level"], string> = {
  danger: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-primary/30 bg-primary/5",
};

const attentionIcons = {
  danger: AlertTriangle,
  warning: TrendingDown,
  info: Info,
} as const;

const attentionLinks = {
  produtos: { to: "/produtos", label: "Ver produtos" },
  fornecedores: { to: "/fornecedores", label: "Ver fornecedores" },
  integracoes: { to: "/integracoes", label: "Conectar meu sistema" },
  comprar: { to: "/comprar", label: "Comparar preços" },
} as const;

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: compras } = useQuery({
    queryKey: ["purchase-insights"],
    queryFn: () => getPurchaseInsights(),
  });
  const missing = Math.max(0, (data?.goal || 0) - (data?.month.revenue || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Olá, {data?.companyName || "comerciante"}!
          </h1>
          <p className="text-muted-foreground mt-1">Veja o que merece sua atenção hoje.</p>
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

      <Card className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Origem dos dados</p>
          <p className="font-medium">
            {data?.dataSource === "manual" ? "Cadastro manual" : "Sem dados ainda"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Última atualização</p>
          <p className="font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {data?.lastUpdatedAt ? dataHoraBR(data.lastUpdatedAt) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Sincronização</p>
          <p className="font-medium">Nenhum sistema conectado</p>
        </div>
        <Link to="/integracoes" className="text-sm text-primary underline ml-auto">
          Conectar meu sistema
        </Link>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Package}
          label="Produtos analisados"
          value={isLoading ? "—" : num(data?.metrics.analyzedProducts)}
          detail="Produtos ativos no cadastro"
        />
        <Metric
          icon={TrendingDown}
          label="Margem baixa"
          value={isLoading ? "—" : num(data?.metrics.lowMarginCount)}
          detail="Sobra menos de 20% por venda"
        />
        <Metric
          icon={PackageX}
          label="Estoque baixo"
          value={isLoading ? "—" : num(data?.metrics.lowStockCount)}
          detail="No mínimo configurado ou abaixo"
        />
        <Metric
          icon={PiggyBank}
          label="Economia identificada"
          value={isLoading ? "—" : brl(data?.economiaIdentificada.porUnidade)}
          detail={
            (data?.economiaIdentificada.produtosComparados || 0) > 0
              ? `Por unidade, em ${data?.economiaIdentificada.itens.length} produto(s)`
              : "Cadastre produtos para comparar com o mercado"
          }
        />
      </div>

      {/* Estes dois números não dependem de nenhuma venda registrada: saem da
          comparação com o mercado e do histórico de negociação. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-primary">
            <PiggyBank className="h-5 w-5" />
            <h2 className="text-sm font-semibold uppercase">Onde você pode economizar</h2>
          </div>
          {!data?.economiaIdentificada.itens.length ? (
            <p className="text-sm text-muted-foreground mt-3">
              {data?.economiaIdentificada.produtosComparados
                ? "Seus custos estão iguais ou melhores que as ofertas da Central."
                : "Cadastre seus produtos com custo e unidade para comparar com o mercado. Não precisa registrar venda."}
            </p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {data.economiaIdentificada.itens.map((item) => (
                <li key={item.produto} className="py-2.5 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.produto}</p>
                    <p className="text-xs text-muted-foreground">
                      Você paga {brl(item.meuCusto)} · {item.fornecedor} oferece{" "}
                      {brl(item.melhorPreco)}/{baseUnitShort[item.baseUnit]}
                    </p>
                  </div>
                  <span className="font-semibold text-success shrink-0">
                    −{num(item.diferencaPercentual, 1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/comprar">Comparar preços</Link>
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 text-success">
            <Handshake className="h-5 w-5" />
            <h2 className="text-sm font-semibold uppercase">Economia já conquistada</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{brl(data?.economiaRealizada.total)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.economiaRealizada.negociacoes
              ? `Em ${data.economiaRealizada.negociacoes} negociação(ões) fechada(s) na Central — ${brl(data.economiaRealizada.mes)} neste mês.`
              : "Negocie um orçamento e a diferença entre a primeira proposta e o valor fechado aparece aqui."}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/orcamentos">Ver orçamentos</Link>
          </Button>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h2 className="text-lg font-semibold">O que precisa da sua atenção</h2>
        </div>
        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_item, index) => (
              <div key={index} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : !data?.attention.length ? (
          <div className="mt-4 flex gap-3 rounded-lg bg-success/10 border border-success/30 p-4">
            <PackageX className="h-5 w-5 text-success shrink-0" />
            <p className="text-sm">
              <strong className="text-success">Tudo certo por aqui.</strong> Nenhum alerta de
              margem, estoque ou fornecedor no momento.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.attention.map((item) => {
              const Icon = attentionIcons[item.level];
              const link = attentionLinks[item.action];
              return (
                <li
                  key={item.id}
                  className={`rounded-lg border p-4 flex flex-wrap gap-3 items-start ${attentionStyles[item.level]}`}
                >
                  <Icon className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-[12rem]">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={link.to}>{link.label}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {data?.bestOpportunity && (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-primary">
            <Truck className="h-5 w-5" />
            <h2 className="text-sm font-semibold uppercase">
              Melhor oportunidade entre fornecedores
            </h2>
          </div>
          <p className="text-lg font-medium mt-3">{data.bestOpportunity.productName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {data.bestOpportunity.bestSupplier} cobra {brl(data.bestOpportunity.unitSavings)} a
            menos por unidade que {data.bestOpportunity.alternativeSupplier} — uma diferença de{" "}
            {num(data.bestOpportunity.savingsPercent, 1)}%.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/fornecedores">Ver cotações</Link>
          </Button>
        </Card>
      )}

      <InsightsPanel data={compras} side="comerciante" />

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
          <h2 className="font-semibold">Quanto sobrou no mês</h2>
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
          <p className="text-xs text-muted-foreground mt-3">
            Calculado sobre {num(data?.month.count)} venda(s) registrada(s) neste mês.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/relatorios">Ver relatório completo</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Package;
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
