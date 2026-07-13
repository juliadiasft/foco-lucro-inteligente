import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Central do Comerciante" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const qc = useQueryClient();
  const { data: empresa } = useQuery({
    queryKey: ["empresa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ nome: "", cnpj: "", tipo_negocio: "", telefone: "" });
  useEffect(() => {
    if (empresa) setForm({ nome: empresa.nome ?? "", cnpj: empresa.cnpj ?? "", tipo_negocio: empresa.tipo_negocio ?? "", telefone: empresa.telefone ?? "" });
  }, [empresa]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empresa) return;
      const { error } = await supabase.from("empresas").update(form).eq("id", empresa.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas!"); qc.invalidateQueries({ queryKey: ["empresa"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Dados da sua empresa</p>
      </div>
      <Card className="p-6">
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }} className="space-y-4">
          <div className="space-y-1.5"><Label>Nome da empresa *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Tipo de negócio</Label><Input placeholder="Ex: Mercearia, Papelaria, Loja de roupas" value={form.tipo_negocio} onChange={(e) => setForm({ ...form, tipo_negocio: e.target.value })} /></div>
          <Button type="submit" disabled={salvar.isPending} className="bg-gradient-hero text-primary-foreground">{salvar.isPending ? "Salvando..." : "Salvar alterações"}</Button>
        </form>
      </Card>
    </div>
  );
}
