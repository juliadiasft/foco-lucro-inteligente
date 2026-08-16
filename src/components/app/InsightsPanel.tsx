import { Card } from "@/components/ui/card";
import { brl, num } from "@/lib/format";

type Insights = {
  total: number;
  mes: number;
  ticket: number;
  pedidosNovos: number;
  pedidosAndamento: number;
  pedidosConcluidos: number;
  evolucao: { rotulo: string; valor: number; pedidos: number }[];
  maiorDaSerie: number;
  topItens: { nome: string; quantidade: number; valor: number }[];
  topParceiros: { nome: string; pedidos: number; valor: number }[];
  financeiro: { aberto: number; vencido: number };
  orcamentosPendentes: number;
};

export function InsightsPanel({
  data,
  side,
}: {
  data: Insights | undefined;
  side: "comerciante" | "fornecedor";
}) {
  const comprando = side === "comerciante";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">
            {comprando ? "Total comprado" : "Total vendido"}
          </p>
          <p className="text-2xl font-bold mt-2">{brl(data?.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {brl(data?.mes)} {comprando ? "comprados" : "vendidos"} neste mês
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Pedidos</p>
          <p className="text-2xl font-bold mt-2">
            {num(data?.pedidosAndamento)}{" "}
            <span className="text-base font-normal text-muted-foreground">em andamento</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {num(data?.pedidosConcluidos)} concluído(s)
            {!comprando && ` · ${num(data?.pedidosNovos)} novo(s) esperando`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Ticket médio</p>
          <p className="text-2xl font-bold mt-2">{brl(data?.ticket)}</p>
          <p className="text-xs text-muted-foreground mt-1">Por pedido fechado</p>
        </Card>
        <Card className="p-5">
          <p
            className={`text-xs font-semibold uppercase ${
              (data?.financeiro.vencido || 0) > 0 ? "text-destructive" : "text-primary"
            }`}
          >
            {comprando ? "Contas a pagar" : "Valores a receber"}
          </p>
          <p className="text-2xl font-bold mt-2">{brl(data?.financeiro.aberto)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(data?.financeiro.vencido || 0) > 0
              ? `${brl(data?.financeiro.vencido)} vencido`
              : "Nada vencido"}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">
          {comprando ? "Evolução dos gastos" : "Evolução das vendas"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Últimos 6 meses</p>
        <div className="mt-5 space-y-2.5">
          {(data?.evolucao || []).map((mes) => {
            const largura =
              data && data.maiorDaSerie > 0 ? (mes.valor / data.maiorDaSerie) * 100 : 0;
            return (
              <div key={mes.rotulo} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-muted-foreground">{mes.rotulo}</span>
                <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded"
                    style={{ width: `${Math.max(largura, mes.valor > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right font-medium">{brl(mes.valor)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">
            {comprando ? "Produtos que mais compra" : "Produtos que mais vende"}
          </h2>
          {!data?.topItens.length ? (
            <p className="text-sm text-muted-foreground mt-3">Nenhum pedido fechado ainda.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {data.topItens.map((item) => (
                <li key={item.nome} className="py-2.5 flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {num(item.quantidade, 3)} embalagem(ns)
                    </p>
                  </div>
                  <span className="font-medium shrink-0">{brl(item.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">
            {comprando ? "Principais fornecedores" : "Clientes que mais compram"}
          </h2>
          {!data?.topParceiros.length ? (
            <p className="text-sm text-muted-foreground mt-3">Nenhum pedido fechado ainda.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {data.topParceiros.map((parceiro) => (
                <li key={parceiro.nome} className="py-2.5 flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{parceiro.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {num(parceiro.pedidos)} pedido(s)
                    </p>
                  </div>
                  <span className="font-medium shrink-0">{brl(parceiro.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
