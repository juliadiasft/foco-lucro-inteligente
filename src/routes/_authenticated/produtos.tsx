import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, Download, Package, PackagePlus, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveProduct,
  listProducts,
  moveStock,
  saveProduct,
  type Product,
} from "@/lib/api/products.functions";
import { listCategories } from "@/lib/api/supplier.functions";
import { downloadCsv } from "@/lib/csv";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Central do Comerciante" }] }),
  component: ProductsPage,
});

const empty = {
  name: "",
  sku: "",
  categoryId: "",
  costPrice: "",
  salePrice: "",
  stock: "",
  minimumStock: "",
  unit: "un",
};
const number = (value: string) => Number(value.replace(",", ".")) || 0;

function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [movementMode, setMovementMode] = useState<"entry" | "adjustment">("entry");
  const [quantity, setQuantity] = useState("");
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["products-pdv"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
  const payload = (id?: string) => ({
    id,
    name: form.name,
    sku: form.sku,
    costPrice: number(form.costPrice),
    salePrice: number(form.salePrice),
    stock: number(form.stock),
    minimumStock: number(form.minimumStock),
    unit: form.unit || "un",
    categoryId: form.categoryId || undefined,
  });
  const create = useMutation({
    mutationFn: () => saveProduct({ data: payload() }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(empty);
      await refresh();
      toast.success("Produto cadastrado!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: () => saveProduct({ data: payload(editing!.id) }),
    onSuccess: async () => {
      setManageOpen(false);
      await refresh();
      toast.success("Produto atualizado!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const movement = useMutation({
    mutationFn: () =>
      moveStock({
        data: { productId: editing!.id, mode: movementMode, quantity: number(quantity) },
      }),
    onSuccess: async () => {
      setManageOpen(false);
      setQuantity("");
      await refresh();
      toast.success("Estoque atualizado!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const archive = useMutation({
    mutationFn: () => archiveProduct({ data: { id: editing!.id } }),
    onSuccess: async () => {
      setManageOpen(false);
      await refresh();
      toast.success("Produto arquivado; o histórico foi preservado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase()),
  );
  const openManage = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku || "",
      categoryId: product.categoryId || "",
      costPrice: String(product.costPrice),
      salePrice: String(product.salePrice),
      stock: String(product.stock),
      minimumStock: String(product.minimumStock),
      unit: product.unit,
    });
    setQuantity("");
    setMovementMode("entry");
    setManageOpen(true);
  };
  const exportCsv = () =>
    downloadCsv(
      `produtos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Produto", "SKU", "Custo", "Venda", "Estoque", "Mínimo", "Unidade"],
      filtered.map((p) => [
        p.name,
        p.sku,
        p.costPrice,
        p.salePrice,
        p.stock,
        p.minimumStock,
        p.unit,
      ]),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Catálogo, preços e estoque</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(empty)}>
                <Plus className="h-4 w-4 mr-1" /> Novo produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar produto</DialogTitle>
              </DialogHeader>
              <ProductForm form={form} setForm={setForm} showStock />
              <Button
                disabled={create.isPending || !form.name.trim()}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Salvando..." : "Salvar produto"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : !filtered.length ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 font-medium">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-right">Custo</th>
                  <th className="p-3 text-right">Venda</th>
                  <th className="p-3 text-right">Margem</th>
                  <th className="p-3 text-right">Estoque</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const margin =
                    p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice) * 100 : 0;
                  const low = p.stock <= p.minimumStock && p.minimumStock > 0;
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-muted-foreground">{p.sku || "—"}</td>
                      <td className="p-3 text-right">{brl(p.costPrice)}</td>
                      <td className="p-3 text-right">{brl(p.salePrice)}</td>
                      <td
                        className={`p-3 text-right font-medium ${margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-destructive"}`}
                      >
                        {num(margin, 1)}%
                      </td>
                      <td className={`p-3 text-right ${low ? "text-warning font-semibold" : ""}`}>
                        {num(p.stock)} {p.unit}
                      </td>
                      <td className="p-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openManage(p)}>
                          <Pencil className="h-4 w-4 mr-1" /> Gerenciar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="font-semibold flex gap-2">
                <Pencil className="h-4 w-4" /> Dados e preços
              </h3>
              <ProductForm form={form} setForm={setForm} />
              <Button
                className="w-full"
                disabled={update.isPending || !form.name.trim()}
                onClick={() => update.mutate()}
              >
                Salvar alterações
              </Button>
            </section>
            <section className="space-y-3 border-t pt-5">
              <h3 className="font-semibold flex gap-2">
                <PackagePlus className="h-4 w-4" /> Movimentar estoque
              </h3>
              <p className="text-sm text-muted-foreground">
                Saldo atual: {num(editing?.stock)} {editing?.unit}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={movementMode === "entry" ? "default" : "outline"}
                  onClick={() => setMovementMode("entry")}
                >
                  Adicionar
                </Button>
                <Button
                  variant={movementMode === "adjustment" ? "default" : "outline"}
                  onClick={() => setMovementMode("adjustment")}
                >
                  Definir saldo
                </Button>
              </div>
              <Field label={movementMode === "entry" ? "Quantidade recebida" : "Novo saldo"}>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                className="w-full"
                disabled={movement.isPending || quantity === ""}
                onClick={() => movement.mutate()}
              >
                Registrar movimentação
              </Button>
            </section>
            <section className="border-t pt-5">
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
              >
                <Archive className="h-4 w-4 mr-1" /> Arquivar produto
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({
  form,
  setForm,
  showStock = false,
}: {
  form: typeof empty;
  setForm: (value: typeof empty) => void;
  showStock?: boolean;
}) {
  const { data: categorias } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Nome *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      </div>
      <Field label="SKU">
        <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
      </Field>
      <Field label="Categoria">
        <select
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          <option value="">Sem categoria</option>
          {(categorias || []).map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Unidade">
        <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
      </Field>
      <Field label="Custo (R$)">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
        />
      </Field>
      <Field label="Venda (R$)">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.salePrice}
          onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
        />
      </Field>
      {showStock && (
        <Field label="Estoque inicial">
          <Input
            type="number"
            min="0"
            step="0.001"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
        </Field>
      )}
      <div className={showStock ? "" : "col-span-2"}>
        <Field label="Estoque mínimo">
          <Input
            type="number"
            min="0"
            step="0.001"
            value={form.minimumStock}
            onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
