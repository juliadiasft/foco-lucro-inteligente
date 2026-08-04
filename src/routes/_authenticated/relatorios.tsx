import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileBarChart, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getReport } from "@/lib/api/dashboard.functions";
import { downloadCsv } from "@/lib/csv";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Central do Comerciante" }] }),
  component: ReportsPage,
});
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function ReportsPage() {
  const today = useMemo(() => new Date(), []);
  const firstDay = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const [from, setFrom] = useState(isoDate(firstDay));
  const [to, setTo] = useState(isoDate(today));
  const range = {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59.999`).toISOString(),
  };
  const { data, isLoading } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => getReport({ data: range }),
    enabled: Boolean(from && to),
  });
  const exportDaily = () => {
    if (data)
      downloadCsv(
        `relatorio-${from}-a-${to}.csv`,
        ["Data", "Vendas", "Faturamento", "Lucro"],
        data.daily.map((day) => [day.day, day.sales, day.revenue, day.profit]),
      );
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Resultados por período, produtos e formas de pagamento.
          </p>
        </div>
        <Button variant="outline" disabled={!data?.daily.length} onClick={exportDaily}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Metric label="Vendas" value={isLoading ? "—" : String(data?.summary.sales || 0)} />
        <Metric label="Faturamento" value={isLoading ? "—" : brl(data?.summary.revenue)} />
        <Metric label="Custos" value={isLoading ? "—" : brl(data?.summary.cost)} />
        <Metric label="Lucro" value={isLoading ? "—" : brl(data?.summary.profit)} />
        <Metric label="Margem" value={isLoading ? "—" : `${num(data?.summary.margin, 1)}%`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Produtos que mais faturam</h2>
          </div>
          {!data?.topProducts.length ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">Produto</th>
                    <th className="p-3 text-right">Qtd.</th>
                    <th className="p-3 text-right">Faturamento</th>
                    <th className="p-3 text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.productName} className="border-t">
                      <td className="p-3 font-medium">{p.productName}</td>
                      <td className="p-3 text-right">{p.quantity}</td>
                      <td className="p-3 text-right">{brl(p.revenue)}</td>
                      <td className="p-3 text-right text-success">{brl(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Formas de pagamento</h2>
          </div>
          {!data?.payments.length ? (
            <Empty />
          ) : (
            <div className="p-4 space-y-3">
              {data.payments.map((payment) => (
                <div key={payment.paymentMethod} className="flex justify-between border-b pb-3">
                  <div>
                    <p className="font-medium capitalize">{payment.paymentMethod}</p>
                    <p className="text-xs text-muted-foreground">{payment.sales} venda(s)</p>
                  </div>
                  <p className="font-semibold">{brl(payment.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}
function Empty() {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">Sem vendas neste período.</div>
  );
}
