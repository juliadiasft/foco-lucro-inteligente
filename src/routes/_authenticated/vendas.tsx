import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listSales } from "@/lib/api/sales.functions";
import { downloadCsv } from "@/lib/csv";
import { brl, dataHoraBR, diaBR, horaBR, num } from "@/lib/format";
import { cn } from "@/lib/utils";

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

type Venda = Awaited<ReturnType<typeof listSales>>[number];

// Histórico de vendas no celular.
//
// Era uma tabela de cinco colunas, com data e hora até os segundos em cada
// linha, rolando de lado no celular. Quem abre o histórico quer saber quanto
// vendeu em cada dia: agora as vendas vêm agrupadas por dia, com o total e o
// que sobrou do dia no cabeçalho do grupo, e cada linha mostra só a hora.
function SalesPage() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });

  // O dia é o do calendário de quem está olhando (a venda das 23h é daquele
  // dia, não do seguinte em Londres).
  const dias: { chave: string; rotulo: string; vendas: Venda[] }[] = [];
  for (const venda of sales) {
    const quando = new Date(venda.soldAt);
    const chave = `${quando.getFullYear()}-${quando.getMonth()}-${quando.getDate()}`;
    const ultimo = dias[dias.length - 1];
    if (ultimo?.chave === chave) ultimo.vendas.push(venda);
    else dias.push({ chave, rotulo: diaBR(venda.soldAt), vendas: [venda] });
  }

  const exportCsv = () =>
    downloadCsv(
      `vendas-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Data",
        "Cliente",
        "Pagamento",
        "Produtos",
        "Subtotal",
        "Desconto",
        "Total",
        "Custo",
        "Lucro",
      ],
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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">Histórico de vendas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quanto entrou e quanto sobrou, dia a dia.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/pdv">
            <Plus className="mr-1 h-4 w-4" /> Vender
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_item, indice) => (
            <div key={indice} className="h-12 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : !sales.length ? (
        <Card className="p-10 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-medium">Nenhuma venda registrada</p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/pdv">Registrar venda</Link>
          </Button>
        </Card>
      ) : (
        <>
          {dias.map((dia) => {
            const total = dia.vendas.reduce((soma, v) => soma + v.total, 0);
            const sobra = dia.vendas.reduce((soma, v) => soma + v.profit, 0);
            return (
              <section key={dia.chave}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {dia.rotulo}
                  </h2>
                  <p className="text-sm tabular-nums">
                    <span className="font-semibold">{brl(total)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {num(dia.vendas.length)} {dia.vendas.length === 1 ? "venda" : "vendas"}
                    </span>
                  </p>
                </div>
                <p className="text-right text-xs text-success tabular-nums">
                  sobraram {brl(sobra)}
                </p>
                <ul className="mt-1 divide-y divide-border border-y border-border">
                  {dia.vendas.map((sale) => (
                    <li key={sale.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">
                        {horaBR(sale.soldAt)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                          {sale.customerName ? ` · ${sale.customerName}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {/* Linhas da venda, e não unidades: 3 sachês e 1 areia são 2 produtos. */}
                          {num(sale.itemCount)} {sale.itemCount === 1 ? "produto" : "produtos"}
                          {sale.discount > 0 ? ` · desconto de ${brl(sale.discount)}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="font-semibold">{brl(sale.total)}</p>
                        <p
                          className={cn(
                            "text-xs",
                            sale.profit >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {sale.profit >= 0 ? "+" : ""}
                          {brl(sale.profit)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Exportar planilha
          </Button>
        </>
      )}
    </div>
  );
}
