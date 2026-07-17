import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Store, Package, Rocket, CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — Central do Comerciante" }] }),
  component: OnboardingPage,
});

const tiposNegocio = [
  "Mercearia / Mercadinho",
  "Padaria",
  "Loja de Roupas",
  "Farmácia",
  "Papelaria",
  "Petshop",
  "Restaurante / Lanchonete",
  "Loja de Cosméticos",
  "Autopeças",
  "Outro",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [empresa, setEmpresa] = useState({ nome: "", tipo: "", cnpj: "", telefone: "" });
  const [meta, setMeta] = useState({ faturamento: "", ticket: "" });

  const finalizar = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("id", user!.id).maybeSingle();
      if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
      const { error: eE } = await supabase
        .from("empresas")
        .update({
          nome: empresa.nome,
          tipo_negocio: empresa.tipo,
          cnpj: empresa.cnpj || null,
          telefone: empresa.telefone || null,
          meta_faturamento_mensal: Number(meta.faturamento.replace(",", ".")) || 0,
          ticket_medio_esperado: Number(meta.ticket.replace(",", ".")) || 0,
        })
        .eq("id", prof.empresa_id);
      if (eE) throw eE;
      const { error: eP } = await supabase.from("profiles").update({ onboarding_completo: true }).eq("id", user!.id);
      if (eP) throw eP;
    },
    onSuccess: () => {
      toast.success("Tudo pronto! Bem-vindo à Central do Comerciante 🎉");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeAvancar1 = empresa.nome.trim().length > 1 && empresa.tipo.length > 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Progresso */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`h-2 w-12 md:w-20 rounded-full transition-colors ${step >= n ? "bg-primary" : "bg-muted"}`} />
            </div>
          ))}
        </div>

        <Card className="p-6 md:p-10 shadow-elegant">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground">
                  <Store className="h-7 w-7" />
                </div>
                <h1 className="mt-4 text-2xl md:text-3xl font-bold">Vamos conhecer seu comércio</h1>
                <p className="text-muted-foreground mt-2">Essas informações personalizam o Consultor de Lucro IA</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome do seu comércio *</Label>
                  <Input id="nome" placeholder="Ex: Mercearia do João" value={empresa.nome} onChange={(e) => setEmpresa({ ...empresa, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de negócio *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {tiposNegocio.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEmpresa({ ...empresa, tipo: t })}
                        className={`text-sm px-3 py-2.5 rounded-lg border transition-colors text-left ${empresa.tipo === t ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                    <Input id="cnpj" placeholder="00.000.000/0000-00" value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tel">Telefone (opcional)</Label>
                    <Input id="tel" placeholder="(11) 99999-9999" value={empresa.telefone} onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled={!podeAvancar1} onClick={() => setStep(2)} className="bg-gradient-hero text-primary-foreground">
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground">
                  <Package className="h-7 w-7" />
                </div>
                <h1 className="mt-4 text-2xl md:text-3xl font-bold">Nos ajude a calibrar o Consultor</h1>
                <p className="text-muted-foreground mt-2">Não se preocupe, você pode ajustar depois</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fat">Faturamento médio mensal (R$)</Label>
                  <Input id="fat" inputMode="decimal" placeholder="Ex: 25000" value={meta.faturamento} onChange={(e) => setMeta({ ...meta, faturamento: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Estimativa para comparar seus resultados com o ideal do seu segmento</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tic">Ticket médio por venda (R$)</Label>
                  <Input id="tic" inputMode="decimal" placeholder="Ex: 45" value={meta.ticket} onChange={(e) => setMeta({ ...meta, ticket: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button onClick={() => setStep(3)} className="bg-gradient-hero text-primary-foreground">
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground">
                  <Rocket className="h-7 w-7" />
                </div>
                <h1 className="mt-4 text-2xl md:text-3xl font-bold">Tudo pronto para decolar!</h1>
                <p className="text-muted-foreground mt-2">Veja o que já está esperando por você:</p>
              </div>

              <div className="grid gap-3">
                {[
                  { i: Package, t: "Cadastre seus produtos", d: "Adicione produtos com preço de custo e venda" },
                  { i: Sparkles, t: "Consultor de Lucro IA", d: "Descubra onde você está perdendo dinheiro" },
                  { i: CheckCircle2, t: "Registre vendas no PDV", d: "Baixa automática de estoque e cálculo de lucro" },
                ].map((it, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <it.i className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{it.t}</p>
                      <p className="text-sm text-muted-foreground">{it.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button
                  disabled={finalizar.isPending}
                  onClick={() => finalizar.mutate()}
                  className="bg-gradient-hero text-primary-foreground"
                  size="lg"
                >
                  {finalizar.isPending ? "Preparando..." : "Acessar meu painel"} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
