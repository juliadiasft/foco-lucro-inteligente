import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash2, Search, ShoppingCart, Receipt, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Produto = Database["public"]["Tables"]["produtos"]["Row"];
type FormaPagamento = Database["public"]["Enums"]["forma_pagamento"];

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({ meta: [{ title: "PDV — Central do Comerciante" }] }),
  component: PDVPage,
});

const pagamentos: { value: FormaPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

function PDVPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [cliente, setCliente] = useState("");
  const [desconto, setDesconto] = useState("0");
  const [pagamento, setPagamento] = useState<FormaPagamento>("dinheiro");

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-pdv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return produtos.slice(0, 24);
    return produtos.filter((p) => p.nome.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)).slice(0, 24);
  }, [produtos, busca]);

  const adicionar = (p: Produto) => {
    setCarrinho((c) => {
      const idx = c.findIndex((i) => i.produto.id === p.id);
      if (idx >= 0) {
        const novo = [...c];
        novo[idx] = { ...novo[idx], quantidade: novo[idx].quantidade + 1 };
        return novo;
      }
      return [...c, { produto: p, quantidade: 1 }];
    });
  };

  const alterarQtd = (id: string, delta: number) => {
    setCarrinho((c) =>
      c.flatMap((i) => {
        if (i.produto.id !== id) return [i];
        const q = i.quantidade + delta;
        return q <= 0 ? [] : [{ ...i, quantidade: q }];
      })
    );
  };

  const remover = (id: string) => setCarrinho((c) => c.filter((i) => i.produto.id !== id));

  const subtotal = carrinho.reduce((s, i) => s + Number(i.produto.preco_venda) * i.quantidade, 0);
  const custo = carrinho.reduce((s, i) => s + Number(i.produto.preco_custo) * i.quantidade, 0);
  const desc = Math.max(0, Number(desconto.replace(",", ".")) || 0);
  const total = Math.max(0, subtotal - desc);
  const lucro = total - custo;

  const finalizar = useMutation({
    mutationFn: async () => {
      if (carrinho.length === 0) throw new Error("Adicione produtos ao carrinho");
      const { data: prof } = await supabase.from("profiles").select("empresa_id").maybeSingle();
      if (!prof?.empresa_id) throw new Error("Empresa não encontrada");
      const { data: user } = await supabase.auth.getUser();

      const { data: venda, error: eV } = await supabase
        .from("vendas")
        .insert({
          empresa_id: prof.empresa_id,
          created_by: user.user?.id ?? null,
          cliente_nome: cliente || null,
          forma_pagamento: pagamento,
          subtotal,
          desconto: desc,
          total,
          custo_total: custo,
          lucro,
        })
        .select()
        .single();
      if (eV) throw eV;

      const itens = carrinho.map((i) => ({
        venda_id: venda.id,
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        preco_unitario: Number(i.produto.preco_venda),
        custo_unitario: Number(i.produto.preco_custo),
        subtotal: Number(i.produto.preco_venda) * i.quantidade,
      }));
      const { error: eI } = await supabase.from("vendas_itens").insert(itens);
      if (eI) throw eI;

      // Baixa de estoque via movimentações
      const movs = carrinho.map((i) => ({
        empresa_id: prof.empresa_id!,
        produto_id: i.produto.id,
        tipo: "saida" as const,
        quantidade: i.quantidade,
        observacao: `Venda #${venda.id.slice(0, 8)}`,
      }));
      await supabase.from("movimentacoes_estoque").insert(movs);
    },
    onSuccess: () => {
      toast.success("Venda registrada com sucesso!");
      setCarrinho([]);
      setCliente("");
      setDesconto("0");
      setPagamento("dinheiro");
      qc.invalidateQueries({ queryKey: ["produtos-pdv"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["vendas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">PDV — Registrar Venda</h1>
        <p className="text-muted-foreground">Adicione produtos, calcule o lucro em tempo real e finalize a venda</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Produtos */}
        <Card className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto por nome ou SKU..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          {produtos.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Nenhum produto cadastrado. Cadastre produtos primeiro para vender.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto">
              {filtrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => adicionar(p)}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="font-medium text-sm line-clamp-2">{p.nome}</div>
                  <div className="text-xs text-muted-foreground mt-1">Estoque: {Number(p.estoque_atual)}</div>
                  <div className="text-primary font-bold mt-1">{brl(Number(p.preco_venda))}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Carrinho */}
        <Card className="p-4 flex flex-col max-h-[80vh]">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Carrinho ({carrinho.length})</h2>
            {carrinho.length > 0 && (
              <button onClick={() => setCarrinho([])} className="ml-auto text-xs text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px]">
            {carrinho.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum item adicionado</p>
            ) : (
              carrinho.map((i) => (
                <div key={i.produto.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.produto.nome}</div>
                    <div className="text-xs text-muted-foreground">{brl(Number(i.produto.preco_venda))} un.</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => alterarQtd(i.produto.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{i.quantidade}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => alterarQtd(i.produto.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remover(i.produto.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border mt-3 pt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cliente" className="text-xs">Cliente (opcional)</Label>
              <Input id="cliente" placeholder="Nome do cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-xs">Desconto (R$)</Label>
                <Input id="desc" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pagamento</Label>
                <Select value={pagamento} onValueChange={(v) => setPagamento(v as FormaPagamento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {pagamentos.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1 text-sm bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              {desc > 0 && <div className="flex justify-between text-destructive"><span>Desconto</span><span>-{brl(desc)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>Total</span><span className="text-primary">{brl(total)}</span></div>
              <div className="flex justify-between text-xs text-success"><span>Lucro estimado</span><span>{brl(lucro)}</span></div>
            </div>

            <Button
              onClick={() => finalizar.mutate()}
              disabled={finalizar.isPending || carrinho.length === 0}
              className="w-full bg-gradient-hero text-primary-foreground"
              size="lg"
            >
              <Receipt className="h-4 w-4 mr-2" />
              {finalizar.isPending ? "Registrando..." : "Finalizar venda"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
