import { useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRecuperado } from "@/lib/api/recuperado.functions";
import { tituloDoFim, vezesAMensalidade } from "@/lib/fim-do-teste";
import { brl } from "@/lib/format";
import { planLabels, planLimits, planPricesBRL, type PlanName } from "@/lib/plans";

// X05: nos últimos dias do teste, mostra o que a Central achou — só o que é
// verdade (recuperado e o que segue na mesa), sem projeção por mês — e a saída:
// continuar no plano, sabendo que nada é apagado se não assinar.
export function FimDoTeste({
  dias,
  plano,
  continuando,
  aoContinuar,
}: {
  dias: number;
  plano: PlanName;
  continuando: boolean;
  aoContinuar: () => void;
}) {
  const { data } = useQuery({ queryKey: ["recuperado"], queryFn: () => getRecuperado() });
  const limites = planLimits[plano];
  const mensalidade = planPricesBRL[plano];
  const recuperado = data?.total ?? 0;
  const naMesa = data?.naMesa.total ?? 0;
  const achou = recuperado > 0 || naMesa > 0;
  const vezes = vezesAMensalidade(recuperado, mensalidade);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">{tituloDoFim(dias)}</h2>

      {achou && (
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            O que a Central achou no seu teste
          </p>
          {naMesa > 0 && (
            <div className="mt-3">
              <p className="text-3xl font-bold text-success tabular-nums">{brl(naMesa)}</p>
              <p className="text-sm text-muted-foreground">
                na mesa, em {data?.naMesa.quantos}{" "}
                {data?.naMesa.quantos === 1 ? "achado" : "achados"} (na primeira compra de cada
                item)
              </p>
            </div>
          )}
          {recuperado > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-success/40 p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p>
                Você já recuperou <strong className="text-success">{brl(recuperado)}</strong>
                {vezes ? `. Isso é ${vezes}.` : "."}
              </p>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{planLabels[plano]}</p>
            <p className="text-xs text-muted-foreground">
              {Number.isFinite(limites.products)
                ? `${limites.products} produtos`
                : "produtos ilimitados"}
              {limites.aiRequestsPerMonth > 0 && ` · ${limites.aiRequestsPerMonth} perguntas`} ·{" "}
              {limites.users} {limites.users === 1 ? "usuário" : "usuários"}
            </p>
          </div>
          <p className="text-right">
            <span className="text-2xl font-bold tabular-nums">{brl(mensalidade)}</span>
            <span className="block text-xs text-muted-foreground">por mês</span>
          </p>
        </div>
        <Button size="lg" className="mt-4 w-full" disabled={continuando} onClick={aoContinuar}>
          {continuando ? "Abrindo..." : `Continuar no ${planLabels[plano]}`}
        </Button>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Se não assinar, seus produtos, vendas e histórico ficam guardados. Nada é apagado agora.
        </p>
      </div>
    </div>
  );
}
