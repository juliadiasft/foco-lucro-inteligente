import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { chamadaDaRegiao, passosDoFornecedor, type EstadoDoFornecedor } from "@/lib/primeiro-dia";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = EstadoDoFornecedor & {
  buscasNaRegiao: number;
  regiao: string | null;
  oQueProcuraram: Array<{ termo: string; buscas: number; comerciantes: number }>;
};

/**
 * O painel de quem acabou de chegar.
 *
 * Substitui três vazios em sequência — "nenhum cliente esperando", "nenhum
 * nicho escolhido", "ainda não há avaliações" — por uma coisa só: o que falta
 * para ser encontrado, e quanta procura existe agora.
 */
export function PrimeiroDiaDoFornecedor(props: Props) {
  const passos = passosDoFornecedor(props);
  const feitos = passos.filter((passo) => passo.feito).length;
  const proximo = passos.find((passo) => !passo.feito);
  const chamada = chamadaDaRegiao(props.buscasNaRegiao, props.vitrinePublicada, props.regiao);

  return (
    <div className="space-y-6">
      {/* A procura da região vem antes da lista de tarefas: é o motivo de a
          lista existir. Sem busca registrada o bloco some — um "0 buscas" em
          corpo grande convence o fornecedor a ir embora. */}
      {chamada && (
        <Card className="border-primary/30 bg-primary/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Procurando você
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight tabular-nums md:text-3xl">
            {props.buscasNaRegiao} {props.buscasNaRegiao === 1 ? "busca" : "buscas"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{chamada}</p>
          {proximo && (
            <Button asChild className="mt-4 min-h-11 w-full sm:w-auto">
              <Link to={proximo.para}>{proximo.titulo}</Link>
            </Button>
          )}
        </Card>
      )}

      {props.oQueProcuraram.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            O que eles procuraram
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {props.oQueProcuraram.map((linha) => (
              <li key={linha.termo} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{linha.termo}</p>
                  <p className="text-xs text-muted-foreground">
                    {num(linha.buscas)} {linha.buscas === 1 ? "busca" : "buscas"} ·{" "}
                    {num(linha.comerciantes)}{" "}
                    {linha.comerciantes === 1 ? "comerciante" : "comerciantes"}
                  </p>
                </div>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Falta terminar
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {feitos} de {passos.length}
          </span>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {passos.map((passo) => (
            <li key={passo.chave}>
              {passo.feito ? (
                <div className="flex items-center gap-3 p-4">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15"
                    aria-hidden="true"
                  >
                    <Check className="h-4 w-4 text-primary" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-muted-foreground line-through">
                      {passo.titulo}
                    </span>
                    <span className="block text-xs text-muted-foreground">{passo.porque}</span>
                  </span>
                </div>
              ) : (
                <Link
                  to={passo.para}
                  className={cn(
                    "flex min-h-11 items-center gap-3 p-4 transition-colors",
                    "hover:bg-muted focus-visible:bg-muted",
                  )}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold tabular-nums"
                    aria-hidden="true"
                  >
                    {passos.indexOf(passo) + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{passo.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{passo.porque}</span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
