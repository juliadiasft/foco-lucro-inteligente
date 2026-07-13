import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Central do Comerciante" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", sku: "", preco_custo: "", preco_venda: "", estoque_atual: "", estoque_minimo: "", unidade: "un" });

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("empresa_id").single();
      if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
      const { error } = await supabase.from("produtos").insert({
        empresa_id: prof.empresa_id,
        nome: form.nome,
        sku: form.sku || null,
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        estoque_atual: Number(form.estoque_atual) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
        unidade: form.unidade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto cadastrado!");
      setOpen(false);
      setForm({ nome: "", sku: "", preco_custo: "", preco_venda: "", estoque_atual: "", estoque_minimo: "", unidade: "un" });
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtrados = (produtos ?? []).filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu catálogo e estoque</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-hero text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Novo produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); criar.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="space-y-1"><Label>Unidade</Label><Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} /></div>
                <div className="space-y-1"><Label>Preço de custo (R$)</Label><Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} /></div>
                <div className="space-y-1"><Label>Preço de venda (R$)</Label><Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} /></div>
                <div className="space-y-1"><Label>Estoque atual</Label><Input type="number" step="0.001" value={form.estoque_atual} onChange={(e) => setForm({ ...form, estoque_atual: e.target.value })} /></div>
                <div className="space-y-1"><Label>Estoque mínimo</Label><Input type="number" step="0.001" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></div>
              </div>
              <Button type="submit" disabled={criar.isPending} className="w-full bg-gradient-hero text-primary-foreground">
                {criar.isPending ? "Salvando..." : "Salvar produto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou SKU..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 font-medium">Nenhum produto cadastrado</p>
            <p className="text-sm text-muted-foreground">Comece cadastrando seu primeiro produto</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Produto</th><th className="p-3">SKU</th><th className="p-3 text-right">Custo</th>
                  <th className="p-3 text-right">Venda</th><th className="p-3 text-right">Margem</th><th className="p-3 text-right">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const margem = Number(p.preco_venda) > 0 ? ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_venda)) * 100 : 0;
                  const baixo = Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3 font-medium">{p.nome}</td>
                      <td className="p-3 text-muted-foreground">{p.sku || "—"}</td>
                      <td className="p-3 text-right">{brl(Number(p.preco_custo))}</td>
                      <td className="p-3 text-right">{brl(Number(p.preco_venda))}</td>
                      <td className={`p-3 text-right font-medium ${margem >= 30 ? "text-success" : margem >= 15 ? "text-warning" : "text-destructive"}`}>{num(margem, 1)}%</td>
                      <td className={`p-3 text-right ${baixo ? "text-warning font-semibold" : ""}`}>{num(Number(p.estoque_atual))} {p.unidade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
