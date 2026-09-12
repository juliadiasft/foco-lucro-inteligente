import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronRight,
  Handshake,
  Info,
  PiggyBank,
  Plus,
  TrendingDown,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

// O Painel abre com dinheiro, e não com saudação.
//
// Antes ele começava com "Olá, fulano", dois botões e um cartão de sincronização
// — informação de encanamento — e o primeiro número era "produtos analisados".
// Quem abre o app do banco vê o saldo primeiro; quem abre isto aqui precisa ver
// quanto vendeu e quanto sobrou. O resto desceu, e o que estava zerado sumiu:
// cartão vazio ocupa o mesmo espaço de um cheio e ensina a ignorar a tela.

const atencaoCores: Record<AttentionItem["level"], string> = {
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-primary",
};

const atencaoIcones = {
  danger: AlertTriangle,
  warning: TrendingDown,
  info: Info,
} as const;

const atencaoDestinos = {
  produtos: "/produtos",
  fornecedores: "/fornecedores",
  integracoes: "/integracoes",
  comprar: "/comprar",
} as const;

const mesPorExtenso = () =>
  new Date().toLocaleDateString("pt-BR", { month: "long" }).replace(/^./, (l) => l.toUpperCase());

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: compras } = useQuery({
    queryKey: ["purchase-insights"],
    queryFn: () => getPurchaseInsights(),
  });

  const mes = data?.month;
  const meta = data?.goal || 0;
  const falta = Math.max(0, meta - (mes?.revenue || 0));
  const semVendaNoMes = !isLoading && !mes?.count;
  const economia = data?.economiaIdentificada;

  return (
    <div className="space-y-8">
      {/* O mês, em um bloco só: o quanto entrou, o quanto sobrou e a meta. */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vendido em {mesPorExtenso()}
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums md:text-5xl">
          {isLoading ? "—" : brl(mes?.revenue)}
        </p>
        {semVendaNoMes ? (
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Nenhuma venda registrada neste mês. Conecte seu sistema para trazer as vendas
            automaticamente, ou registre uma agora.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Sobraram <strong className="font-semibold text-success">{brl(mes?.profit)}</strong> —
            margem de {num(mes?.margin, 1)}% em {num(mes?.count)} venda(s).
          </p>
        )}

        {meta > 0 && !semVendaNoMes && (
          <div className="mt-4 max-w-md">
            <Progress value={data?.goalProgress} className="h-2" />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                <strong className="font-semibold text-foreground">
                  {Math.round(data?.goalProgress || 0)}%
                </strong>{" "}
                da meta de {brl(meta)}
              </span>
              <span>faltam {brl(falta)}</span>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/pdv">
              <Plus className="mr-1 h-4 w-4" /> Registrar venda
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/comprar">Comparar preços</Link>
          </Button>
          {!meta && (
            <Button asChild variant="ghost">
              <Link to="/configuracoes">Definir meta do mês</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Precisa de você: lista com divisória, e não um cartão por alerta. A
          linha inteira é o link — no celular, alvo grande é o que se acerta. */}
      <section>
        <h2 className="text-lg font-semibold">Precisa de você</h2>
        {isLoading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_item, indice) => (
              <div key={indice} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : !data?.attention.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum alerta de margem, estoque ou fornecedor no momento.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {data.attention.map((item) => {
              const Icone = atencaoIcones[item.level];
              return (
                <li key={item.id}>
                  <Link
                    to={atencaoDestinos[item.action]}
                    className="flex items-start gap-3 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${atencaoCores[item.level]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{item.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Os três contadores, numa faixa só. Eram quatro cartões do tamanho do
          faturamento — competindo com ele por atenção sem merecer.
          O terceiro conta quem está abaixo do estoque mínimo, e é isso que o
          rótulo diz: "Estoque baixo: 0" logo abaixo de três avisos de "pode
          acabar nos próximos dias" parecia erro, e são contas diferentes. */}
      <section className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border">
        {[
          { to: "/produtos", rotulo: "Produtos", valor: data?.metrics.analyzedProducts },
          { to: "/produtos", rotulo: "Margem baixa", valor: data?.metrics.lowMarginCount },
          { to: "/produtos", rotulo: "Abaixo do mínimo", valor: data?.metrics.lowStockCount },
        ].map((contador) => (
          <Link
            key={contador.rotulo}
            to={contador.to}
            className="px-3 py-3 transition-colors hover:bg-muted/50"
          >
            <p className="text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : num(contador.valor)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{contador.rotulo}</p>
          </Link>
        ))}
      </section>

      {/* Economia: só aparece quando existe. */}
      {Boolean(economia?.itens.length) && (
        <section>
          <div className="flex items-center gap-2 text-primary">
            <PiggyBank className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Onde você pode economizar
            </h2>
          </div>
          <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
            {economia?.itens.map((item) => (
              <li key={item.produto} className="flex flex-wrap justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.produto}</p>
                  <p className="text-xs text-muted-foreground">
                    Você paga {brl(item.meuCusto)} · {item.fornecedor} oferece{" "}
                    {brl(item.melhorPreco)}/{baseUnitShort[item.baseUnit]}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-success tabular-nums">
                  −{num(item.diferencaPercentual, 1)}%
                </span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/comprar">Comparar preços</Link>
          </Button>
        </section>
      )}

      {Boolean(data?.economiaRealizada.total) && (
        <section className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
          <Handshake className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="font-semibold">
              {brl(data?.economiaRealizada.total)} economizados negociando
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Em {num(data?.economiaRealizada.negociacoes)} negociação(ões) fechada(s) na Central —{" "}
              {brl(data?.economiaRealizada.mes)} neste mês.
            </p>
          </div>
        </section>
      )}

      {data?.bestOpportunity && (
        <section>
          <div className="flex items-center gap-2 text-primary">
            <Truck className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Melhor oportunidade entre fornecedores
            </h2>
          </div>
          <p className="mt-2 font-medium">{data.bestOpportunity.productName}</p>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            {data.bestOpportunity.bestSupplier} cobra {brl(data.bestOpportunity.unitSavings)} a
            menos por unidade que {data.bestOpportunity.alternativeSupplier} — uma diferença de{" "}
            {num(data.bestOpportunity.savingsPercent, 1)}%.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/fornecedores">Ver cotações</Link>
          </Button>
        </section>
      )}

      <InsightsPanel data={compras} side="comerciante" />

      {/* De onde vêm os números. Era um cartão no topo, antes de qualquer
          informação de negócio; aqui embaixo responde quem for conferir. */}
      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        {data?.dataSource === "manual" ? "Dados do cadastro manual" : "Sem dados ainda"}
        {data?.lastUpdatedAt ? ` · atualizado em ${dataHoraBR(data.lastUpdatedAt)}` : ""} ·{" "}
        <Link to="/integracoes" className="text-primary hover:underline">
          conectar meu sistema
        </Link>
      </p>
    </div>
  );
}
