import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listSales } from "@/lib/api/sales.functions";
import { downloadCsv } from "@/lib/csv";
import { brl, dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Central do Comerciante" }] }),
  component: SalesPage,
});
const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  boleto: "Boleto",
  other: "Outro",
};

function SalesPage() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });
  const exportCsv = () =>
    downloadCsv(
      `vendas-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Cliente", "Pagamento", "Itens", "Subtotal", "Desconto", "Total", "Custo", "Lucro"],
      sales.map((sale) => [
        dataHoraBR(sale.soldAt),
        sale.customerName,
        paymentLabels[sale.paymentMethod],
        sale.itemCount,
        sale.subtotal,
        sale.discount,
        sale.total,
        sale.totalCost,
        sale.profit,
      ]),
    );
  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Histórico de vendas</h1>
          <p className="text-muted-foreground">Acompanhe faturamento e lucro.</p>
        </div>
        <Button variant="outline" disabled={!sales.length} onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">Carregando...</div>
        ) : !sales.length ? (
          <div className="p-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 font-medium">Nenhuma venda registrada</p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/pdv">Ir para o PDV</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-t">
                    <td className="p-3">{dataHoraBR(sale.soldAt)}</td>
                    <td className="p-3">{sale.customerName || "—"}</td>
                    <td className="p-3">{paymentLabels[sale.paymentMethod]}</td>
                    <td className="p-3 text-right font-medium">{brl(sale.total)}</td>
                    <td
                      className={`p-3 text-right font-medium ${sale.profit >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {brl(sale.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
