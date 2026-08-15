import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, Sparkles, TrendingUp, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getStaffOverview } from "@/lib/api/staff.functions";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/adm/")({
  head: () => ({ meta: [{ title: "Visão geral — Back office" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const { data } = useQuery({ queryKey: ["staff-overview"], queryFn: () => getStaffOverview() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Visão geral</h1>
        <p className="text-muted-foreground mt-1">
          Comerciantes e fornecedores somados — os dois lados assinam.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Receita recorrente</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{brl(data?.mrr)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Comerciantes {brl(data?.mrrComerciante)} · Fornecedores {brl(data?.mrrFornecedor)}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Assinaturas ativas</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{num(data?.ativos)}</p>
          <p className="text-xs text-muted-foreground mt-1">Apenas quem está pagando</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Testes em andamento</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{num(data?.trials)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {num(data?.trialsExpirando)} vencendo em até 2 dias
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Pedidos no mês</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{num(data?.pedidos.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {brl(data?.pedidos.valor)} negociados na plataforma
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-sm font-semibold uppercase">Consumo de IA no mês</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          <div>
            <p className="text-sm text-muted-foreground">Perguntas</p>
            <p className="text-2xl font-bold">{num(data?.ia.perguntas)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tokens de entrada</p>
            <p className="text-2xl font-bold">{num(data?.ia.tokensEntrada)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tokens de saída</p>
            <p className="text-2xl font-bold">{num(data?.ia.tokensSaida)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Mostramos o consumo em tokens, não em reais: o preço por token depende do modelo
          contratado e mudaria sem aviso aqui dentro. Multiplique pelo valor da sua tabela na OpenAI
          para chegar ao custo.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Contas por tipo e situação</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">Tipo</th>
                <th className="py-2 pr-4 font-medium">Plano</th>
                <th className="py-2 pr-4 font-medium">Situação</th>
                <th className="py-2 font-medium text-right">Contas</th>
              </tr>
            </thead>
            <tbody>
              {(data?.contasPorTipo || []).map((row) => (
                <tr
                  key={`${row.accountType}-${row.plan}-${row.status}`}
                  className="border-b last:border-0"
                >
                  <td className="py-2 pr-4 capitalize">{row.accountType}</td>
                  <td className="py-2 pr-4 capitalize">{row.plan}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 text-right font-medium">{num(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
