import { useState } from "react";
import { Check, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

// A segunda metade da história.
//
// O painel do topo responde "qual fornecedor é o mais barato". Esta seção
// respondia a mesma coisa com outro produto, e as duas ficaram redundantes —
// foi o que a Julia notou. Aqui a pergunta passa a ser outra: "e quanto isso
// vale no meu ano?".
//
// A conta é do próprio visitante: ele escolhe quanto compra por mês e vê o
// número mudar. Centavos por unidade não impressionam ninguém; o mesmo valor
// projetado em doze meses é o que faz o comerciante querer olhar.
//
// Os R$ 4.320,00 que já estavam nesta seção correspondem exatamente a 50
// caixas por mês. O número continua verdadeiro e agora mostra de onde vem.

const CARO = 4.8;
const BARATO = 4.2;
const UNIDADES_POR_CAIXA = 12;
const VOLUMES = [10, 25, 50];

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EconomiaAnual() {
  const [caixasPorMes, setCaixasPorMes] = useState(50);

  const porUnidade = CARO - BARATO;
  const porMes = porUnidade * UNIDADES_POR_CAIXA * caixasPorMes;
  const porAno = porMes * 12;

  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Refrigerante 2L — Cola</p>
        <span className="text-sm text-muted-foreground">
          {reais(BARATO)} contra {reais(CARO)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Diferença de <strong className="text-foreground">{reais(porUnidade)}</strong> por unidade
        entre o fornecedor mais barato e o mais caro.
      </p>

      <p className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">
        Quantas caixas você compra por mês?
      </p>
      <div
        role="radiogroup"
        aria-label="Caixas por mês"
        className="mt-2 inline-flex rounded-lg border border-border bg-muted/40 p-1"
      >
        {VOLUMES.map((volume) => (
          <button
            key={volume}
            type="button"
            role="radio"
            aria-checked={caixasPorMes === volume}
            onClick={() => setCaixasPorMes(volume)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm transition-all duration-200 active:scale-[0.97]",
              caixasPorMes === volume
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {volume}
          </button>
        ))}
      </div>

      {/* O tamanho do número acompanha a largura: em 375px, "R$ 4.320,00" em
          text-2xl encostava na borda da célula. */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
        <div className="bg-card p-4">
          <p className="text-xs text-muted-foreground">Por mês</p>
          <p className="mt-1 font-display text-xl font-bold sm:text-2xl">{reais(porMes)}</p>
        </div>
        <div className="bg-success/5 p-4">
          <p className="text-xs text-muted-foreground">No ano</p>
          <p className="mt-1 font-display text-xl font-bold text-success sm:text-2xl">
            {reais(porAno)}
          </p>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <span>
          E isso é <strong className="text-foreground">um produto só</strong>. A Central faz essa
          conta para o catálogo inteiro, todo dia.
        </span>
      </p>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-primary" />
        Valores de exemplo, com preços reais de mercado
      </p>
    </div>
  );
}
