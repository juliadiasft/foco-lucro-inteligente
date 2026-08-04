import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Package,
  Rocket,
  Sparkles,
  Store,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { completeOnboarding } from "@/lib/api/company.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — Central do Comerciante" }] }),
  component: OnboardingPage,
});

const businessTypes = [
  "Mercadinho",
  "Padaria",
  "Loja de roupas",
  "Farmácia",
  "Papelaria",
  "Pet shop",
  "Restaurante",
  "Cosméticos",
  "Autopeças",
  "Outro",
];
const money = (value: string) => Number(value.replace(",", ".")) || 0;

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState({
    name: user?.companyName || "",
    businessType: "",
    cnpj: "",
    phone: user?.phone || "",
  });
  const [goals, setGoals] = useState({ revenue: "", ticket: "" });

  const finish = useMutation({
    mutationFn: () =>
      completeOnboarding({
        data: {
          name: company.name,
          businessType: company.businessType,
          cnpj: company.cnpj,
          phone: company.phone,
          monthlyRevenueGoal: money(goals.revenue),
          expectedAverageTicket: money(goals.ticket),
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Tudo pronto! Sua central já está configurada.");
      navigate({ to: "/dashboard" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((number) => (
            <div
              key={number}
              className={`h-2 w-16 md:w-24 rounded-full ${step >= number ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <Card className="p-6 md:p-10 shadow-elegant">
          {step === 1 && (
            <div className="space-y-6">
              <Intro
                icon={Store}
                title="Vamos conhecer seu comércio"
                text="Essas informações personalizam suas análises de lucro."
              />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome do comércio *</Label>
                  <Input
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de negócio *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {businessTypes.map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setCompany({ ...company, businessType: type })}
                        className={`text-sm px-3 py-2.5 rounded-lg border text-left ${company.businessType === type ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted"}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>CNPJ (opcional)</Label>
                    <Input
                      value={company.cnpj}
                      onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={company.phone}
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  disabled={company.name.trim().length < 2 || !company.businessType}
                  onClick={() => setStep(2)}
                >
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <Intro
                icon={Package}
                title="Defina seus objetivos"
                text="Você poderá alterar estes valores depois."
              />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Meta de faturamento mensal (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goals.revenue}
                    onChange={(e) => setGoals({ ...goals, revenue: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ticket médio desejado (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goals.ticket}
                    onChange={(e) => setGoals({ ...goals, ticket: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button onClick={() => setStep(3)}>
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <Intro
                icon={Rocket}
                title="Tudo pronto para começar"
                text="Seu teste Profissional de 14 dias já está ativo."
              />
              <div className="grid gap-3">
                {[
                  [Package, "Produtos e estoque", "Cadastre custos, preços e saldos."],
                  [
                    Sparkles,
                    "Consultor com IA",
                    "Converse com a IA usando os dados reais do negócio.",
                  ],
                  [CheckCircle2, "PDV e lucro", "Registre vendas com baixa automática de estoque."],
                ].map(([Icon, title, text]) => (
                  <div key={String(title)} className="flex gap-3 p-4 rounded-lg border bg-muted/30">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{String(title)}</p>
                      <p className="text-sm text-muted-foreground">{String(text)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button disabled={finish.isPending} onClick={() => finish.mutate()}>
                  {finish.isPending ? "Preparando..." : "Acessar meu painel"}{" "}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Intro({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-2xl md:text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2">{text}</p>
    </div>
  );
}
