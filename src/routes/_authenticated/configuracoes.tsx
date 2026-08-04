import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCompany, updateCompany } from "@/lib/api/company.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Central do Comerciante" }] }),
  component: SettingsPage,
});

const initial = {
  name: "",
  cnpj: "",
  businessType: "",
  phone: "",
  monthlyRevenueGoal: "",
  expectedAverageTicket: "",
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["company"], queryFn: () => getCompany() });
  const [form, setForm] = useState(initial);
  useEffect(() => {
    if (data)
      setForm({
        name: data.name,
        cnpj: data.cnpj || "",
        businessType: data.businessType || "",
        phone: data.phone || "",
        monthlyRevenueGoal: String(data.monthlyRevenueGoal || ""),
        expectedAverageTicket: String(data.expectedAverageTicket || ""),
      });
  }, [data]);
  const save = useMutation({
    mutationFn: () =>
      updateCompany({
        data: {
          name: form.name,
          cnpj: form.cnpj,
          businessType: form.businessType,
          phone: form.phone,
          monthlyRevenueGoal: Number(form.monthlyRevenueGoal) || 0,
          expectedAverageTicket: Number(form.expectedAverageTicket) || 0,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Configurações salvas!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Dados e metas da empresa</p>
      </div>
      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Nome da empresa *">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CNPJ">
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Tipo de negócio">
            <Input
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Meta mensal (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyRevenueGoal}
                onChange={(e) => setForm({ ...form, monthlyRevenueGoal: e.target.value })}
              />
            </Field>
            <Field label="Ticket desejado (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.expectedAverageTicket}
                onChange={(e) => setForm({ ...form, expectedAverageTicket: e.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </Card>
      <Card className="p-4 border-warning/40 bg-warning/10">
        <h2 className="font-semibold text-sm mb-1">Aviso fiscal</h2>
        <p className="text-xs text-muted-foreground">
          Este sistema controla vendas, estoque e lucro, mas não substitui a emissão de NF-e ou
          NFC-e em emissor autorizado.
        </p>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
