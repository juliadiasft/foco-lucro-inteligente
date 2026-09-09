import { Badge } from "@/components/ui/badge";
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualMonthlyEquivalent,
  annualPricesBRL,
  annualSavingsBRL,
  formatPlanPriceBRL,
  planPricesBRL,
  type BillingCycle,
  type PlanName,
} from "@/lib/plans";

// Mensal ou anual. A porcentagem aparece no seletor, que é onde a pessoa
// ainda está decidindo se olha o anual; o valor em reais aparece no preço,
// que é onde ela decide comprar. Comerciante escolhe olhando "economiza
// R$ 155,88", não "10% off".
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
        {ANNUAL_DISCOUNT_PERCENT}% de desconto no anual
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
        R$ {formatPlanPriceBRL(annualPricesBRL[plan])} à vista no ano
      </p>
      <p className="text-xs font-medium text-success mt-0.5">
        {ANNUAL_DISCOUNT_PERCENT}% de desconto · você economiza R${" "}
        {formatPlanPriceBRL(annualSavingsBRL(plan))} no ano
      </p>
    </div>
  );
}
