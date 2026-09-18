import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Handshake, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { getRecuperado } from "@/lib/api/recuperado.functions";
import { brl, dataBR } from "@/lib/format";
import { filtrarExtrato, type FiltroDoExtrato } from "@/lib/recuperado";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recuperado")({
  head: () => ({ meta: [{ title: "Já recuperado — Central do Comerciante" }] }),
  component: RecuperadoPage,
});

const FILTROS: { id: FiltroDoExtrato; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "compra", rotulo: "Compras" },
  { id: "negociacao", rotulo: "Orçamentos" },
];

function RecuperadoPage() {
  const [filtro, setFiltro] = useState<FiltroDoExtrato>("todas");
  const { data, isLoading } = useQuery({
    queryKey: ["recuperado"],
    queryFn: () => getRecuperado(),
  });
  const itens = data ? filtrarExtrato(data.itens, filtro) : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          aria-label="Voltar ao Painel"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold md:text-3xl">Já recuperado</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.itens.length} ações confirmadas` : "Carregando…"}
          </p>
        </div>
      </div>

      <Card className="border-success/30 bg-success/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Confirmado pelas suas compras e orçamentos
        </p>
        <p className="mt-2 text-4xl font-bold text-success tabular-nums md:text-5xl">
          {brl(data?.total ?? 0)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{brl(data?.mes ?? 0)} neste mês</p>
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Ainda na mesa</p>
          <p className="text-lg font-semibold tabular-nums">{brl(data?.naMesa.total ?? 0)}</p>
          <p className="text-xs text-muted-foreground">
            {data?.naMesa.quantos
              ? `${data.naMesa.quantos} produto(s) com fornecedor da Central mais barato, na primeira compra. `
              : "Nenhum fornecedor da Central mais barato que o seu custo agora. "}
            Não entra no total acima: só conta depois que você compra.
          </p>
          {data?.naMesa.quantos ? (
            <Link to="/fornecedores" className="mt-1 inline-block text-sm text-primary underline">
              Ver comparação
            </Link>
          ) : null}
        </div>
      </Card>

      <div className="flex gap-2" role="tablist" aria-label="Filtrar extrato">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm font-medium",
              filtro === f.id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card className="h-40 animate-pulse bg-muted/40" />
      ) : itens.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {data?.itens.length
            ? "Nada nesta categoria."
            : "Ainda não há economia confirmada. Ela aparece aqui quando você conclui uma compra mais barata que o seu custo anterior, ou fecha um orçamento abaixo da primeira proposta."}
        </Card>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {itens.map((item) => {
            const Icone = item.tipo === "compra" ? ShoppingCart : Handshake;
            return (
              <li key={item.id} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <Icone className="h-4 w-4 text-success" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detalhe} · {dataBR(item.em)}
                  </p>
                </div>
                <p className="font-semibold text-success tabular-nums">{brl(item.valor)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
