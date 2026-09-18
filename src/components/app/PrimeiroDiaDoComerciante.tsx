import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Scale, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  chamadaDeComparar,
  passosDoComerciante,
  posicaoDoComerciante,
  type EstadoDoComerciante,
} from "@/lib/primeiro-dia";
import { cn } from "@/lib/utils";

/**
 * O Painel de quem acabou de chegar (N01).
 *
 * Substitui "R$ 0,00" em corpo grande por o que falta para a Central achar o
 * primeiro vazamento — e por um atalho que entrega valor com zero cadastro:
 * comparar preços, o único módulo que funciona sem dado nenhum.
 */
export function PrimeiroDiaDoComerciante(props: EstadoDoComerciante & { nome: string }) {
  const passos = passosDoComerciante(props);
  const { feitos, total, proximo } = posicaoDoComerciante(passos);
  const comparar = chamadaDeComparar(props.itensNaRegiao, props.fornecedoresNaRegiao);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold md:text-3xl">Olá, {props.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dia 1 na Central do Comerciante</p>
      </div>

      <Card className="border-primary/30 bg-primary/5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ativação
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {feitos} de {total}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold leading-tight md:text-3xl">
          Vamos achar o seu primeiro vazamento
        </p>
        <Progress value={(feitos / total) * 100} className="mt-4 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          Leva uns 6 minutos — dá para parar e voltar depois.
        </p>
        {proximo && (
          <Button asChild className="mt-4 min-h-11 w-full sm:w-auto">
            <Link to="/importar">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" /> Trazer minha planilha
            </Link>
          </Button>
        )}
      </Card>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {passos.map((passo, indice) => (
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
                  {indice + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{passo.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{passo.porque}</span>
                  {passo.progresso && (
                    <span className="mt-2 flex items-center gap-2">
                      <Progress
                        value={(passo.progresso.atual / passo.progresso.total) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {passo.progresso.atual}/{passo.progresso.total}
                      </span>
                    </span>
                  )}
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

      <div className="space-y-2">
        <p className="text-center text-xs text-muted-foreground">e sem cadastrar nada</p>
        <Link
          to="/comprar"
          className="flex min-h-14 items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
            aria-hidden="true"
          >
            <Scale className="h-5 w-5 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Comparar preços</span>
            <span className="block text-xs text-muted-foreground">
              {comparar ?? "Veja quanto cada distribuidor cobra pelo mesmo produto"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
