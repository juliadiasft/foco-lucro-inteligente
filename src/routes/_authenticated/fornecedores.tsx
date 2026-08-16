import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  ArrowDown,
  CircleDollarSign,
  Download,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SupplierDirectory } from "@/components/app/SupplierDirectory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  archiveSupplier,
  deleteSupplierPrice,
  listSupplierPrices,
  listSuppliers,
  saveSupplier,
  saveSupplierPrice,
} from "@/lib/api/suppliers.functions";
import { listProducts } from "@/lib/api/products.functions";
import { downloadCsv } from "@/lib/csv";
import { brl, dataBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — Central do Comerciante" }] }),
  component: SuppliersPage,
});

type Supplier = Awaited<ReturnType<typeof listSuppliers>>[number];
type SupplierPrice = {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  price: number;
  minimumQuantity: number;
  notes: string | null;
  quotedAt: string;
  rank: number;
};
type SupplierOpportunity = {
  title: string;
  message: string;
  payload: {
    productName: string;
    bestSupplierName: string;
    bestPrice: number;
    alternativeSupplierName: string;
    alternativePrice: number;
    unitSavings: number;
    savingsPercent: number;
    minimumQuantity: number;
    orderSavings: number;
  };
};
const empty = {
  name: "",
  cnpj: "",
  contactName: "",
  phone: "",
  email: "",
  deliveryDays: "",
  notes: "",
};

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [newOpportunity, setNewOpportunity] = useState<SupplierOpportunity | null>(null);
  const [form, setForm] = useState(empty);
  const [quote, setQuote] = useState({
    supplierId: "",
    productId: "",
    price: "",
    minimumQuantity: "1",
    notes: "",
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });
  const { data: pricesData = [] } = useQuery({
    queryKey: ["supplier-prices"],
    queryFn: () => listSupplierPrices(),
  });
  const prices = pricesData as SupplierPrice[];
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
      queryClient.invalidateQueries({ queryKey: ["supplier-prices"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
  const save = useMutation({
    mutationFn: () =>
      saveSupplier({
        data: {
          id: editing?.id,
          name: form.name,
          cnpj: form.cnpj,
          contactName: form.contactName,
          phone: form.phone,
          email: form.email,
          deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : null,
          notes: form.notes,
        },
      }),
    onSuccess: async () => {
      setOpen(false);
      await refresh();
      toast.success(editing ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const archive = useMutation({
    mutationFn: () => archiveSupplier({ data: { id: editing!.id } }),
    onSuccess: async () => {
      setOpen(false);
      await refresh();
      toast.success("Fornecedor arquivado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveQuote = useMutation({
    mutationFn: () =>
      saveSupplierPrice({
        data: {
          supplierId: quote.supplierId,
          productId: quote.productId,
          price: Number(quote.price),
          minimumQuantity: Number(quote.minimumQuantity) || 1,
          notes: quote.notes,
        },
      }),
    onSuccess: async (result: { opportunity: SupplierOpportunity | null }) => {
      setQuote({ supplierId: "", productId: "", price: "", minimumQuantity: "1", notes: "" });
      await refresh();
      if (result.opportunity) {
        setNewOpportunity(result.opportunity);
        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      toast.success("Cotação salva e comparação atualizada!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeQuote = useMutation({
    mutationFn: (id: string) => deleteSupplierPrice({ data: { id } }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const edit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      cnpj: supplier.cnpj || "",
      contactName: supplier.contactName || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      deliveryDays: supplier.deliveryDays == null ? "" : String(supplier.deliveryDays),
      notes: supplier.notes || "",
    });
    setOpen(true);
  };
  const exportCsv = () =>
    downloadCsv(
      `fornecedores-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Fornecedor", "Contato", "Telefone", "Email", "Prazo (dias)", "CNPJ"],
      suppliers.map((s) => [s.name, s.contactName, s.phone, s.email, s.deliveryDays, s.cnpj]),
    );
  const comparisons = Array.from(
    prices.reduce<Map<string, SupplierPrice[]>>((groups, price: SupplierPrice) => {
      const group = groups.get(price.productId) || [];
      group.push(price);
      groups.set(price.productId, group);
      return groups;
    }, new Map<string, SupplierPrice[]>()),
  )
    .map(([, entries]) => entries.slice().sort((a, b) => a.price - b.price))
    .filter((entries) => entries.length > 1 && entries[1].price > entries[0].price)
    .map((entries) => {
      const best = entries[0];
      const alternative = entries[1];
      const unitSavings = alternative.price - best.price;
      return {
        productId: best.productId,
        productName: best.productName,
        best,
        alternative,
        unitSavings,
        savingsPercent: (unitSavings / alternative.price) * 100,
        orderSavings: unitSavings * Math.max(1, best.minimumQuantity),
      };
    })
    .sort((a, b) => b.savingsPercent - a.savingsPercent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Fornecedores</h1>
        <p className="text-muted-foreground">
          Os fornecedores do seu nicho aparecem aqui automaticamente. Cadastrar na mão é só para
          quem ainda não está na Central.
        </p>
      </div>
      <Tabs defaultValue="central">
        <TabsList>
          <TabsTrigger value="central">Na Central</TabsTrigger>
          <TabsTrigger value="suppliers">Meus cadastrados</TabsTrigger>
          <TabsTrigger value="prices">Comparar preços</TabsTrigger>
        </TabsList>
        <TabsContent value="central">
          <SupplierDirectory />
        </TabsContent>
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={!suppliers.length} onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={startNew}>
                  <Plus className="h-4 w-4 mr-1" /> Novo fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
                </DialogHeader>
                <SupplierForm form={form} setForm={setForm} />
                <Button
                  disabled={save.isPending || !form.name.trim()}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => archive.mutate()}
                  >
                    <Archive className="h-4 w-4 mr-1" /> Arquivar
                  </Button>
                )}
              </DialogContent>
            </Dialog>
          </div>
          {!suppliers.length ? (
            <Card className="p-12 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-3 font-medium">Nenhum fornecedor cadastrado</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {suppliers.map((s) => (
                <Card key={s.id} className="p-5">
                  <div className="flex justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{s.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {s.contactName || "Contato não informado"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => edit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 text-sm space-y-1">
                    <p>{s.phone || "Sem telefone"}</p>
                    <p>{s.email || "Sem email"}</p>
                    <p>
                      {s.deliveryDays == null
                        ? "Prazo não informado"
                        : `${s.deliveryDays} dias para entrega`}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="prices" className="space-y-4">
          <Card className="p-5">
            <div className="flex gap-2 items-center mb-4">
              <Scale className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Nova cotação</h2>
                <p className="text-sm text-muted-foreground">
                  Uma cotação por fornecedor e produto; ao salvar novamente, o preço é atualizado.
                </p>
              </div>
            </div>
            {!suppliers.length || !products.length ? (
              <p className="text-sm text-warning">
                Cadastre pelo menos um fornecedor e um produto antes de comparar.
              </p>
            ) : (
              <div className="grid md:grid-cols-5 gap-3">
                <Select
                  value={quote.productId}
                  onValueChange={(value) => setQuote({ ...quote, productId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={quote.supplierId}
                  onValueChange={(value) => setQuote({ ...quote, supplierId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Preço (R$)"
                  value={quote.price}
                  onChange={(e) => setQuote({ ...quote, price: e.target.value })}
                />
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Qtd. mínima"
                  value={quote.minimumQuantity}
                  onChange={(e) => setQuote({ ...quote, minimumQuantity: e.target.value })}
                />
                <Button
                  disabled={
                    saveQuote.isPending ||
                    !quote.productId ||
                    !quote.supplierId ||
                    quote.price === ""
                  }
                  onClick={() => saveQuote.mutate()}
                >
                  Salvar cotação
                </Button>
              </div>
            )}
          </Card>
          {comparisons.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Oportunidades encontradas</h2>
                <p className="text-sm text-muted-foreground">
                  Comparação automática, sem consumir créditos da IA.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {comparisons.map((comparison) => (
                  <Card
                    key={comparison.productId}
                    className="overflow-hidden border-success/30 bg-success/5"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-success/20 p-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-success">
                          Melhor oportunidade
                        </p>
                        <h3 className="mt-1 text-lg font-bold">{comparison.productName}</h3>
                      </div>
                      <Badge className="border-transparent bg-success text-success-foreground">
                        <ArrowDown className="mr-1 h-3 w-3" />
                        {comparison.savingsPercent.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Melhor preço</p>
                          <p className="font-semibold text-success">
                            {comparison.best.supplierName}
                          </p>
                          <p className="text-xl font-bold">{brl(comparison.best.price)}</p>
                        </div>
                        <ArrowDown className="h-5 w-5 -rotate-90 text-success" />
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Próxima opção</p>
                          <p className="font-medium">{comparison.alternative.supplierName}</p>
                          <p className="text-xl font-bold text-muted-foreground">
                            {brl(comparison.alternative.price)}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-background p-3 text-sm shadow-sm">
                        <strong>Economia de {brl(comparison.unitSavings)} por unidade.</strong>
                        {comparison.best.minimumQuantity > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            No pedido mínimo de {comparison.best.minimumQuantity}, você economiza{" "}
                            {brl(comparison.orderSavings)}.
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {!prices.length ? (
            <Card className="p-12 text-center">
              <Scale className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-3 font-medium">Nenhuma cotação registrada</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Fornecedor</th>
                      <th className="p-3 text-right">Preço</th>
                      <th className="p-3 text-right">Qtd. mínima</th>
                      <th className="p-3">Atualizado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((price) => (
                      <tr
                        key={price.id}
                        className={`border-t ${price.rank === 1 ? "bg-success/5" : ""}`}
                      >
                        <td className="p-3 font-medium">{price.productName}</td>
                        <td className="p-3">
                          {price.supplierName}{" "}
                          {price.rank === 1 && (
                            <Badge className="ml-2 bg-success">Melhor preço</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold">{brl(price.price)}</td>
                        <td className="p-3 text-right">{price.minimumQuantity}</td>
                        <td className="p-3 text-muted-foreground">{dataBR(price.quotedAt)}</td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeQuote.mutate(price.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={Boolean(newOpportunity)}
        onOpenChange={(value) => !value && setNewOpportunity(null)}
      >
        <DialogContent className="max-w-xl overflow-hidden p-0">
          {newOpportunity && (
            <>
              <div className="bg-gradient-hero p-6 text-primary-foreground">
                <CircleDollarSign className="mb-4 h-10 w-10" />
                <DialogHeader>
                  <DialogTitle className="text-2xl">Encontramos uma economia!</DialogTitle>
                  <DialogDescription className="text-primary-foreground/80">
                    A comparação foi feita automaticamente e não gastou créditos da IA.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-5 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {newOpportunity.payload.productName}
                  </p>
                  <p className="text-xl font-bold">{newOpportunity.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <p className="text-xs text-muted-foreground">Comprar de</p>
                    <p className="font-semibold text-success">
                      {newOpportunity.payload.bestSupplierName}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {brl(newOpportunity.payload.bestPrice)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground">Em vez de</p>
                    <p className="font-semibold">
                      {newOpportunity.payload.alternativeSupplierName}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-muted-foreground">
                      {brl(newOpportunity.payload.alternativePrice)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <p className="font-semibold">
                    Você economiza {brl(newOpportunity.payload.unitSavings)} por unidade ({" "}
                    {newOpportunity.payload.savingsPercent.toFixed(1)}%).
                  </p>
                  {newOpportunity.payload.minimumQuantity > 1 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Economia de {brl(newOpportunity.payload.orderSavings)} no pedido mínimo de{" "}
                      {newOpportunity.payload.minimumQuantity} unidades.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Quando a IA estiver com créditos, ela poderá analisar estoque, giro e margem para
                  indicar a quantidade mais vantajosa.
                </div>
                <DialogFooter>
                  <Button className="w-full sm:w-auto" onClick={() => setNewOpportunity(null)}>
                    Entendi a oportunidade
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierForm({
  form,
  setForm,
}: {
  form: typeof empty;
  setForm: (value: typeof empty) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Nome *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      </div>
      <Field label="CNPJ">
        <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
      </Field>
      <Field label="Contato">
        <Input
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
        />
      </Field>
      <Field label="Telefone">
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="Prazo de entrega (dias)">
        <Input
          type="number"
          min="0"
          value={form.deliveryDays}
          onChange={(e) => setForm({ ...form, deliveryDays: e.target.value })}
        />
      </Field>
      <div className="col-span-2">
        <Field label="Observações">
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
