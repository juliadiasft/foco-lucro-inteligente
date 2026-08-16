import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  featureDescriptions,
  featureLabels,
  formatPlanPriceBRL,
  planIncludes,
  planLabels,
  planPricesBRL,
  requiredPlanFor,
  type PlanFeature,
} from "@/lib/plans";

export function useFeature(feature: PlanFeature) {
  const { user } = useAuth();
  return user ? planIncludes(user.plan, feature) : false;
}

// O recurso bloqueado continua visível e explicado. Sumir do menu esconderia
// justamente o motivo de trocar de plano — e quem fez o teste de 7 dias no
// Profissional já usou isto e sabe do que se trata.
export function FeatureLock({ feature, children }: { feature: PlanFeature; children?: ReactNode }) {
  const liberado = useFeature(feature);
  if (liberado) return <>{children}</>;

  const plano = requiredPlanFor(feature);

  return (
    <Card className="p-8 text-center border-primary/30 bg-primary/5">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-lg font-semibold mt-4">{featureLabels[feature]}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        {featureDescriptions[feature]}
      </p>
      <p className="text-sm font-medium mt-4">
        Disponível a partir do plano {planLabels[plano]} — R${" "}
        {formatPlanPriceBRL(planPricesBRL[plano])}
        /mês
      </p>
      <Button asChild size="lg" className="mt-4">
        <Link to="/assinatura">Ver planos</Link>
      </Button>
    </Card>
  );
}
