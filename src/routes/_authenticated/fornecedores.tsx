import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — Central do Comerciante" }] }),
  component: FornecedoresPage,
});

function FornecedoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", contato: "", telefone: "", email: "", prazo_entrega_dias: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("empresa_id").single();
      if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
      const { error } = await supabase.from("fornecedores").insert({
        empresa_id: prof.empresa_id,
        nome: form.nome,
        cnpj: form.cnpj || null,
        contato: form.contato || null,
        telefone: form.telefone || null,
        email: form.email || null,
        prazo_entrega_dias: form.prazo_entrega_dias ? Number(form.prazo_entrega_dias) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor cadastrado!");
      setOpen(false);
      setForm({ nome: "", cnpj: "", contato: "", telefone: "", email: "", prazo_entrega_dias: "" });
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie seus parceiros comerciais</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Novo fornecedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar fornecedor</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); criar.mutate(); }} className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                <div className="space-y-1"><Label>Contato</Label><Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></div>
                <div className="space-y-1"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1 col-span-2"><Label>Prazo de entrega (dias)</Label><Input type="number" value={form.prazo_entrega_dias} onChange={(e) => setForm({ ...form, prazo_entrega_dias: e.target.value })} /></div>
              </div>
              <Button type="submit" disabled={criar.isPending} className="w-full bg-gradient-hero text-primary-foreground">{criar.isPending ? "Salvando..." : "Salvar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 font-medium">Nenhum fornecedor cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Nome</th><th className="p-3">CNPJ</th><th className="p-3">Contato</th><th className="p-3">Telefone</th><th className="p-3">Prazo</th></tr>
              </thead>
              <tbody>
                {data!.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="p-3 font-medium">{f.nome}</td>
                    <td className="p-3 text-muted-foreground">{f.cnpj || "—"}</td>
                    <td className="p-3">{f.contato || "—"}</td>
                    <td className="p-3">{f.telefone || "—"}</td>
                    <td className="p-3">{f.prazo_entrega_dias ? `${f.prazo_entrega_dias} dias` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
