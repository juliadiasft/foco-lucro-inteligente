import { useEffect, useState } from "react";
import { Check, PiggyBank, TrendingDown } from "lucide-react";

import { cn } from "@/lib/utils";

// O visual do topo da página, em HTML — e não uma foto.
//
// A imagem que estava aqui era uma pessoa segurando um tablet cuja tela era
// rabisco: o "dashboard" na mão dela não tinha uma palavra legível. Quem
// olhasse de perto veria uma imitação de sistema, e isso derruba a confiança
// na página inteira.
//
// Feito em markup, o painel carrega instantâneo, fica nítido em qualquer tela,
// acompanha o tema claro e escuro, e mostra a comparação que é o coração do
// produto — em vez de sugerir com foto de banco de imagens.
//
// Os números são de exemplo e a legenda diz isso. A comparação em si é real:
// é assim que o preço por quilo revela que a embalagem maior nem sempre é a
// mais barata.

type Linha = {
  fornecedor: string;
  cidade: string;
  embalagem: string;
  preco: number;
  porQuilo: number;
};

const LINHAS: Linha[] = [
  {
    fornecedor: "Atacadão Pet Sul",
    cidade: "Curitiba",
    embalagem: "15 kg",
    preco: 165,
    porQuilo: 11.0,
  },
  {
    fornecedor: "Pet Distribuidora",
    cidade: "Campinas",
    embalagem: "10 kg",
    preco: 118,
    porQuilo: 11.8,
  },
  {
    fornecedor: "Distribuidora Brasil",
    cidade: "Ribeirão",
    embalagem: "20 kg",
    preco: 196,
    porQuilo: 9.8,
  },
];

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function HeroPanel() {
  const melhor = LINHAS.reduce((a, b) => (b.porQuilo < a.porQuilo ? b : a));
  const pior = LINHAS.reduce((a, b) => (b.porQuilo > a.porQuilo ? b : a));
  const [destaque, setDestaque] = useState<string | null>(null);
  const [entrou, setEntrou] = useState(false);

  // As linhas entram uma depois da outra na primeira vez, para o painel
  // parecer que está calculando em vez de já estar pronto.
  useEffect(() => {
    const menosMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (menosMovimento) {
      setEntrou(true);
      return;
    }
    const t = setTimeout(() => setEntrou(true), 120);
    return () => clearTimeout(t);
  }, []);

  const economiaPorQuilo = pior.porQuilo - melhor.porQuilo;

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-hero opacity-20 blur-3xl rounded-full" />

      <div className="relative rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <span className="ml-2 text-xs text-muted-foreground">
            Comparação de fornecedores · exemplo
          </span>
        </div>

        <div className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Produto</p>
          <p className="font-display text-lg font-bold">Ração para cães adultos</p>

          <div className="mt-4 space-y-2">
            {LINHAS.map((linha, indice) => {
              const eMelhor = linha.fornecedor === melhor.fornecedor;
              const ativo = destaque === linha.fornecedor;
              return (
                <button
                  type="button"
                  key={linha.fornecedor}
                  onMouseEnter={() => setDestaque(linha.fornecedor)}
                  onMouseLeave={() => setDestaque(null)}
                  onFocus={() => setDestaque(linha.fornecedor)}
                  onBlur={() => setDestaque(null)}
                  style={{ transitionDelay: entrou ? `${indice * 90}ms` : undefined }}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-all duration-500",
                    entrou ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3",
                    eMelhor
                      ? "border-success/40 bg-success/5"
                      : "border-border hover:border-primary/40",
                    ativo && "shadow-card -translate-y-0.5",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{linha.fornecedor}</span>
                      <span className="block text-xs text-muted-foreground">
                        {linha.cidade} · embalagem de {linha.embalagem}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span
                        className={cn(
                          "block font-display font-bold",
                          eMelhor ? "text-success" : "text-foreground",
                        )}
                      >
                        {reais(linha.porQuilo)}
                        <span className="text-xs font-normal text-muted-foreground">/kg</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {reais(linha.preco)} a embalagem
                      </span>
                    </span>
                  </div>
                  {eMelhor && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
                      <Check className="h-3.5 w-3.5" /> mais barato por quilo
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
            <TrendingDown className="h-4 w-4 shrink-0 text-success" />
            <span className="text-muted-foreground">
              A embalagem de <strong className="text-foreground">20 kg</strong> sai{" "}
              <strong className="text-foreground">{reais(economiaPorQuilo)}</strong> mais barata por
              quilo que a de 10 kg.
            </span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-6 hidden md:flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
        <div className="h-10 w-10 rounded-lg bg-success/15 text-success flex items-center justify-center">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Economia detectada</p>
          <p className="font-display font-bold">R$ 2.340,00 / mês</p>
        </div>
      </div>
    </div>
  );
}
