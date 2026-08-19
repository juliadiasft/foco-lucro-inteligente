import { Badge } from "@/components/ui/badge";
import {
  ANNUAL_BILLED_MONTHS,
  annualMonthlyEquivalent,
  annualPricesBRL,
  annualSavingsBRL,
  formatPlanPriceBRL,
  planPricesBRL,
  type BillingCycle,
  type PlanName,
} from "@/lib/plans";

// Mensal ou anual, com o desconto dito em dinheiro e não em porcentagem: o
// comerciante decide olhando "economiza R$ 259,80", não "17% off".
export function CycleToggle({
  value,
  onChange,
  anualDisponivel,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  anualDisponivel: boolean;
}) {
  if (!anualDisponivel) return null;
  const opcoes: Array<{ id: BillingCycle; rotulo: string }> = [
    { id: "mensal", rotulo: "Mensal" },
    { id: "anual", rotulo: "Anual" },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div
        role="radiogroup"
        aria-label="Forma de pagamento"
        className="inline-flex rounded-lg border border-border p-1 bg-muted/40"
      >
        {opcoes.map((opcao) => (
          <button
            key={opcao.id}
            type="button"
            role="radio"
            aria-checked={value === opcao.id}
            onClick={() => onChange(opcao.id)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              value === opcao.id
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <Badge variant="outline" className="border-success/40 text-success">
        {12 - ANNUAL_BILLED_MONTHS} meses grátis no anual
      </Badge>
    </div>
  );
}

// O preço aparece sempre por mês nos dois ciclos, para a comparação ser
// possível. O valor cheio do ano fica embaixo, sem letra miúda.
export function PlanPrice({ plan, cycle }: { plan: PlanName; cycle: BillingCycle }) {
  if (cycle === "mensal") {
    return (
      <p className="text-3xl font-bold mt-2">
        R$ {formatPlanPriceBRL(planPricesBRL[plan])}
        <span className="text-sm font-normal text-muted-foreground">/mês</span>
      </p>
    );
  }
  return (
    <div className="mt-2">
      <p className="text-sm text-muted-foreground line-through">
        R$ {formatPlanPriceBRL(planPricesBRL[plan])}/mês
      </p>
      <p className="text-3xl font-bold">
        R$ {formatPlanPriceBRL(annualMonthlyEquivalent(plan))}
        <span className="text-sm font-normal text-muted-foreground">/mês</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        R$ {formatPlanPriceBRL(annualPricesBRL[plan])} à vista no ano · você economiza R${" "}
        {formatPlanPriceBRL(annualSavingsBRL(plan))}
      </p>
    </div>
  );
}
