import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { getIndiceDeSaude } from "@/lib/api/indice-saude.functions";
import { brl } from "@/lib/format";
import { faixaDoIndice, type Faixa } from "@/lib/indice-saude";

const COR: Record<Faixa, string> = {
  boa: "text-success",
  atencao: "text-warning",
  ruim: "text-destructive",
};
const TRACO: Record<Faixa, string> = {
  boa: "stroke-success",
  atencao: "stroke-warning",
  ruim: "stroke-destructive",
};

const R = 52;
const VOLTA = 2 * Math.PI * R;

// M01: o índice de saúde do lucro no topo do Painel — um número, o que está na
// mesa, o que já foi recuperado e o que puxa o número para baixo. O
// "vazando por mês" do desenho ficou de fora: é uma projeção que não medimos.
// No lugar, o que a Central achou de fato (economia na primeira compra).
export function IndiceDeSaude({ recuperado }: { recuperado: number }) {
  const { data } = useQuery({ queryKey: ["indice-de-saude"], queryFn: () => getIndiceDeSaude() });
  const [aberto, setAberto] = useState(false);
  if (!data) return null;

  const faixa = faixaDoIndice(data.score);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Índice de saúde do lucro
        </p>
        {data.variacao && data.variacao.pontos !== 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              data.variacao.pontos > 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
            title={`comparado a ${data.variacao.dias} dias atrás`}
          >
            {data.variacao.pontos > 0 ? "+" : ""}
            {data.variacao.pontos} no mês
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-muted" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              className={TRACO[faixa]}
              strokeDasharray={`${(data.score / 100) * VOLTA} ${VOLTA}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-bold tabular-nums ${COR[faixa]}`}>{data.score}</span>
            <span className="text-xs text-muted-foreground">de 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Na mesa</p>
            <p className="text-2xl font-bold text-warning tabular-nums">{brl(data.naMesa)}</p>
            <p className="text-xs text-muted-foreground">
              {data.achados} {data.achados === 1 ? "achado" : "achados"} de preço, na primeira
              compra
            </p>
          </div>
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground">Já recuperado</p>
            <p className="text-2xl font-bold text-success tabular-nums">{brl(recuperado)}</p>
          </div>
        </div>
      </div>

      {data.puxamParaBaixo.length > 0 ? (
        <div className="mt-4 border-t pt-3">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex w-full items-center gap-2 text-left text-sm font-medium"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="flex-1">
              {data.puxamParaBaixo.length === 1
                ? "1 ponto puxa seu índice para baixo"
                : `${data.puxamParaBaixo.length} pontos puxam seu índice para baixo`}
            </span>
            {aberto ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {aberto && (
            <ul className="mt-3 space-y-2.5">
              {data.puxamParaBaixo.map((p) => (
                <li key={p.chave} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{p.titulo}</span>
                    <span className="block text-muted-foreground">{p.detalhe}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-warning tabular-nums">
                    −{p.perda} pts
                  </span>
                </li>
              ))}
              <li>
                <Link to="/produtos" className="text-sm font-semibold text-primary">
                  Ver meus produtos
                </Link>
              </li>
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
          Nada puxa seu índice para baixo agora.
        </p>
      )}
    </Card>
  );
}
