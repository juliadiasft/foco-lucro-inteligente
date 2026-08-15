import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  CreditCard,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { getStaffOverview } from "@/lib/api/staff.functions";
import { brl, num } from "@/lib/format";
import { planLabels } from "@/lib/plans";

export const Route = createFileRoute("/adm/")({
  head: () => ({ meta: [{ title: "Visão geral — Back office" }] }),
  component: AdminOverview,
});

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "primary",
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  detail?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const tones = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  } as const;
  return (
    <Card className="p-5">
      <div className={`flex items-center gap-2 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
        <h2 className="text-xs font-semibold uppercase">{label}</h2>
      </div>
      <p className="text-3xl font-bold mt-3">{value}</p>
      {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
    </Card>
  );
}

function AdminOverview() {
  const { data } = useQuery({ queryKey: ["staff-overview"], queryFn: () => getStaffOverview() });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Visão geral</h1>
        <p className="text-muted-foreground mt-1">
          Comerciantes e fornecedores somados — os dois lados assinam.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Receita</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={TrendingUp}
            label="MRR"
            value={brl(data?.receita.mrr)}
            detail={`Comerciantes ${brl(data?.receita.mrrComerciante)} · Fornecedores ${brl(data?.receita.mrrFornecedor)}`}
          />
          <Metric
            icon={TrendingUp}
            label="ARR projetado"
            value={brl(data?.receita.arr)}
            detail="MRR atual × 12"
          />
          <Metric
            icon={Users}
            label="Assinaturas ativas"
            value={num(data?.funil.ativas)}
            detail="Apenas quem está pagando"
          />
          <Metric
            icon={CreditCard}
            label="Receita por assinante"
            value={brl(data?.receita.arpu)}
            detail="MRR dividido pelos ativos"
          />
        </div>

        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-3 font-medium">Plano</th>
                <th className="p-3 font-medium text-right">Assinantes</th>
                <th className="p-3 font-medium text-right">MRR</th>
                <th className="p-3 font-medium text-right">Participação</th>
              </tr>
            </thead>
            <tbody>
              {!data?.receita.porPlano.length ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Nenhuma assinatura ativa ainda.
                  </td>
                </tr>
              ) : (
                data.receita.porPlano.map((row) => (
                  <tr key={row.plan} className="border-b last:border-0">
                    <td className="p-3 font-medium">{planLabels[row.plan]}</td>
                    <td className="p-3 text-right">{num(row.contas)}</td>
                    <td className="p-3 text-right">{brl(row.mrr)}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {num(data.receita.mrr > 0 ? (row.mrr / data.receita.mrr) * 100 : 0, 1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Movimento do mês</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={ArrowUpRight}
            label="Novas assinaturas"
            value={num(data?.movimento.novas)}
            detail="Compras aprovadas e assinaturas criadas"
            tone="success"
          />
          <Metric
            icon={ArrowDownRight}
            label="Cancelamentos"
            value={num(data?.movimento.cancelamentos)}
            detail="Cancelamentos, reembolsos e chargebacks"
            tone="destructive"
          />
          <Metric
            icon={ArrowDownRight}
            label="Churn aproximado"
            value={`${num(data?.movimento.churn, 1)}%`}
            detail="Sobre a base reconstruída do início do mês"
            tone="warning"
          />
          <Metric
            icon={ArrowDownRight}
            label="MRR perdido"
            value={brl(data?.movimento.mrrPerdido)}
            detail="Receita mensal das contas canceladas"
            tone="destructive"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Metric
            icon={CreditCard}
            label="Renovações"
            value={num(data?.movimento.renovacoes)}
            detail="Cobranças recorrentes confirmadas no mês"
          />
          <Metric
            icon={AlertTriangle}
            label="Pagamentos recusados"
            value={num(data?.movimento.falhasPagamento)}
            detail="Renovações que a Cakto não conseguiu cobrar"
            tone="warning"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Funil de conversão
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Users}
            label="Contas criadas"
            value={num(data?.funil.totalContas)}
            detail={`${num(data?.funil.novasMes)} criadas neste mês`}
          />
          <Metric
            icon={Users}
            label="Em teste agora"
            value={num(data?.funil.emTeste)}
            detail={`${num(data?.funil.testesVencendo)} vencendo em até 2 dias`}
            tone="warning"
          />
          <Metric
            icon={AlertTriangle}
            label="Testes vencidos sem assinar"
            value={num(data?.funil.testesVencidos)}
            detail="Oportunidade de recuperação"
            tone="destructive"
          />
          <Metric
            icon={TrendingUp}
            label="Conversão"
            value={`${num(data?.funil.conversao, 1)}%`}
            detail="Contas ativas sobre o total já criado"
            tone="success"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Saúde do marketplace
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Store}
            label="Vitrines publicadas"
            value={`${num(data?.marketplace.vitrinesPublicadas)} / ${num(data?.marketplace.fornecedores)}`}
            detail="Fornecedor sem vitrine não aparece na busca"
          />
          <Metric
            icon={ClipboardList}
            label="Itens no catálogo"
            value={num(data?.marketplace.itensCatalogo)}
            detail="Ofertas disponíveis para comparação"
          />
          <Metric
            icon={MessageSquare}
            label="Conversas iniciadas"
            value={num(data?.marketplace.conversasMes)}
            detail="No mês, entre comerciante e fornecedor"
          />
          <Metric
            icon={ClipboardList}
            label="Pedidos no mês"
            value={num(data?.marketplace.pedidosMes)}
            detail={`${brl(data?.marketplace.valorPedidosMes)} negociados`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Operação e custo</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-destructive">
              <CreditCard className="h-5 w-5" />
              <h2 className="text-xs font-semibold uppercase">Cobranças pendentes</h2>
            </div>
            <p className="text-3xl font-bold mt-3">{num(data?.operacional.cobrancasPendentes)}</p>
            <Link to="/adm/cobranca" className="text-xs text-primary underline mt-1 inline-block">
              Pagamentos que não viraram acesso
            </Link>
          </Card>
          <Metric
            icon={ShieldAlert}
            label="Contas suspensas"
            value={num(data?.operacional.suspensas)}
            detail="Bloqueadas pela equipe"
            tone="warning"
          />
          <Metric
            icon={Sparkles}
            label="Perguntas à IA"
            value={num(data?.ia.perguntas)}
            detail={`${num(data?.ia.empresas)} empresa(s) usaram no mês`}
          />
          <Metric
            icon={Sparkles}
            label="Tokens no mês"
            value={num((data?.ia.tokensEntrada || 0) + (data?.ia.tokensSaida || 0))}
            detail={`Entrada ${num(data?.ia.tokensEntrada)} · Saída ${num(data?.ia.tokensSaida)}`}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          O consumo de IA aparece em tokens, não em reais: o preço por token depende do modelo
          contratado e ficaria desatualizado aqui dentro. Multiplique pela sua tabela na OpenAI para
          chegar ao custo e comparar com o MRR acima.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Contas por tipo e situação
        </h2>
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Plano</th>
                <th className="p-3 font-medium">Situação</th>
                <th className="p-3 font-medium text-right">Contas</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contasPorTipo || []).map((row) => (
                <tr
                  key={`${row.accountType}-${row.plan}-${row.status}`}
                  className="border-b last:border-0"
                >
                  <td className="p-3 capitalize">{row.accountType}</td>
                  <td className="p-3">{planLabels[row.plan]}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3 text-right font-medium">{num(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
