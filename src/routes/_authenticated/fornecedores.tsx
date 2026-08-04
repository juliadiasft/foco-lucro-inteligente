import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, Download, Pencil, Plus, Scale, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  const { data: prices = [] } = useQuery({
    queryKey: ["supplier-prices"],
    queryFn: () => listSupplierPrices(),
  });
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
    onSuccess: async () => {
      setQuote({ supplierId: "", productId: "", price: "", minimumQuantity: "1", notes: "" });
      await refresh();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Fornecedores e cotações</h1>
        <p className="text-muted-foreground">Centralize contatos e compare os preços de compra.</p>
      </div>
      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="prices">Comparar preços</TabsTrigger>
        </TabsList>
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
