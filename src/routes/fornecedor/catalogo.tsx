import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listOfferings, removeOffering, saveOffering } from "@/lib/api/supplier.functions";
import { baseUnitLabels, baseUnits, baseUnitShort, type BaseUnit } from "@/lib/catalog";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/fornecedor/catalogo")({
  head: () => ({ meta: [{ title: "Meu catálogo — Central do Comerciante" }] }),
  component: CatalogoPage,
});

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  brand: "",
  baseUnit: "kg" as BaseUnit,
  description: "",
  packSize: "",
  price: "",
  minimumQuantity: "1",
  deliveryDays: "",
};

function CatalogoPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data } = useQuery({ queryKey: ["offerings"], queryFn: () => listOfferings() });

  const save = useMutation({
    mutationFn: () =>
      saveOffering({
        data: {
          id: form.id,
          name: form.name,
          brand: form.brand || undefined,
          baseUnit: form.baseUnit,
          description: form.description || undefined,
          packSize: Number(form.packSize),
          price: form.price === "" ? null : Number(form.price),
          minimumQuantity: Number(form.minimumQuantity || 1),
          deliveryDays: form.deliveryDays === "" ? null : Number(form.deliveryDays),
        },
      }),
    onSuccess: async () => {
      toast.success("Item salvo");
      setOpen(false);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["offerings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeOffering({ data: { id } }),
    onSuccess: async () => {
      toast.success("Item removido do catálogo");
      await queryClient.invalidateQueries({ queryKey: ["offerings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const limit = data?.limit ?? 0;
  const used = data?.items.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Meu catálogo</h1>
          <p className="text-muted-foreground mt-1">
            Informe o tamanho da embalagem. É assim que a Central compara seu preço com o dos outros
            de forma justa.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setForm(emptyForm);
          }}
        >
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-4 w-4 mr-1" /> Adicionar item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar item" : "Novo item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Produto</Label>
                <Input
                  id="name"
                  placeholder="Ex.: Ração para cães adultos"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  placeholder="Ex.: Golden"
                  value={form.brand}
                  onChange={(event) => setForm({ ...form, brand: event.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="baseUnit">Vendido por</Label>
                  <select
                    id="baseUnit"
                    value={form.baseUnit}
                    onChange={(event) =>
                      setForm({ ...form, baseUnit: event.target.value as BaseUnit })
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                  >
                    {baseUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {baseUnitLabels[unit]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="packSize">
                    Tamanho da embalagem ({baseUnitShort[form.baseUnit]})
                  </Label>
                  <Input
                    id="packSize"
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Ex.: 15"
                    value={form.packSize}
                    onChange={(event) => setForm({ ...form, packSize: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Preço da embalagem (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Deixe vazio para sob consulta"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minimumQuantity">Quantidade mínima</Label>
                  <Input
                    id="minimumQuantity"
                    type="number"
                    min={0}
                    step="0.001"
                    value={form.minimumQuantity}
                    onChange={(event) => setForm({ ...form, minimumQuantity: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryDays">Prazo deste item (dias)</Label>
                <Input
                  id="deliveryDays"
                  type="number"
                  min={0}
                  placeholder="Vazio usa o prazo da vitrine"
                  value={form.deliveryDays}
                  onChange={(event) => setForm({ ...form, deliveryDays: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Observações</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={save.isPending || !form.name || !form.packSize}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Salvando..." : "Salvar item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 text-sm flex flex-wrap gap-x-8 gap-y-2">
        <span>
          <strong>{used}</strong> {used === 1 ? "item" : "itens"} no catálogo
        </span>
        <span className="text-muted-foreground">
          Limite do seu plano: {Number.isFinite(limit) ? limit : "ilimitado"}
        </span>
      </Card>

      {!data?.items.length ? (
        <Card className="p-8 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Seu catálogo está vazio.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione o que você fornece para aparecer nas comparações de preço.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <Card key={item.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold leading-tight">{item.name}</h2>
                  {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover item"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-2xl font-bold mt-3">
                {item.price === null ? "Sob consulta" : brl(item.price)}
              </p>
              <p className="text-sm text-muted-foreground">
                Embalagem de {num(item.packSize, 3)} {baseUnitShort[item.baseUnit]}
                {item.pricePerBaseUnit !== null && (
                  <>
                    {" — "}
                    <strong className="text-foreground">
                      {brl(item.pricePerBaseUnit)}/{baseUnitShort[item.baseUnit]}
                    </strong>
                  </>
                )}
              </p>

              <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                <p>Mínimo: {num(item.minimumQuantity, 3)}</p>
                {item.deliveryDays !== null && <p>Prazo: {item.deliveryDays} dia(s)</p>}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setForm({
                    id: item.id,
                    name: item.name,
                    brand: item.brand || "",
                    baseUnit: item.baseUnit,
                    description: item.description || "",
                    packSize: String(item.packSize),
                    price: item.price === null ? "" : String(item.price),
                    minimumQuantity: String(item.minimumQuantity),
                    deliveryDays: item.deliveryDays === null ? "" : String(item.deliveryDays),
                  });
                  setOpen(true);
                }}
              >
                Editar
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
