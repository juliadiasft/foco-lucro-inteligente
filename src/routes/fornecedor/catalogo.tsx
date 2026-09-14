import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Package, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  listCategories,
  listOfferings,
  removeOffering,
  saveOffering,
} from "@/lib/api/supplier.functions";
import {
  availabilityLabels,
  baseUnitLabels,
  baseUnits,
  baseUnitShort,
  type Availability,
  type BaseUnit,
} from "@/lib/catalog";
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
  categoryId: "",
  description: "",
  sku: "",
  packSize: "",
  price: "",
  promoPrice: "",
  promoUntil: "",
  availability: "disponivel" as Availability,
  stock: "",
  minimumQuantity: "1",
  deliveryDays: "",
  tiers: [] as { minQuantity: string; price: string }[],
};

function CatalogoPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const { data } = useQuery({ queryKey: ["offerings"], queryFn: () => listOfferings() });
  const { data: categorias } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
    staleTime: 60 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: () =>
      saveOffering({
        data: {
          id: form.id,
          name: form.name,
          brand: form.brand || undefined,
          baseUnit: form.baseUnit,
          categoryId: form.categoryId || undefined,
          description: form.description || undefined,
          sku: form.sku || undefined,
          packSize: Number(form.packSize),
          price: form.price === "" ? null : Number(form.price),
          promoPrice: form.promoPrice === "" ? null : Number(form.promoPrice),
          promoUntil: form.promoUntil || undefined,
          availability: form.availability,
          stock: form.stock === "" ? null : Number(form.stock),
          minimumQuantity: Number(form.minimumQuantity || 1),
          deliveryDays: form.deliveryDays === "" ? null : Number(form.deliveryDays),
          tiers: form.tiers
            .filter((tier) => tier.minQuantity !== "" && tier.price !== "")
            .map((tier) => ({
              minQuantity: Number(tier.minQuantity),
              price: Number(tier.price),
            })),
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
      setOpen(false);
      setForm(emptyForm);
      setConfirmandoRemocao(false);
      await queryClient.invalidateQueries({ queryKey: ["offerings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  type Item = NonNullable<typeof data>["items"][number];
  const editar = (item: Item) => {
    setConfirmandoRemocao(false);
    setForm({
      id: item.id,
      name: item.name,
      brand: item.brand || "",
      baseUnit: item.baseUnit,
      categoryId: item.categoryId || "",
      description: item.description || "",
      sku: item.sku || "",
      packSize: String(item.packSize),
      price: item.price === null ? "" : String(item.price),
      promoPrice: item.promoPrice === null ? "" : String(item.promoPrice),
      promoUntil: item.promoUntil || "",
      availability: item.availability,
      stock: item.stock === null ? "" : String(item.stock),
      minimumQuantity: String(item.minimumQuantity),
      deliveryDays: item.deliveryDays === null ? "" : String(item.deliveryDays),
      tiers: item.tiers.map((tier) => ({
        minQuantity: String(tier.minQuantity),
        price: String(tier.price),
      })),
    });
    setOpen(true);
  };

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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Marca</Label>
                  <Input
                    id="brand"
                    placeholder="Ex.: Golden"
                    value={form.brand}
                    onChange={(event) => setForm({ ...form, brand: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku">Código / SKU</Label>
                  <Input
                    id="sku"
                    placeholder="Seu código interno"
                    value={form.sku}
                    onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="categoryId">Categoria</Label>
                <select
                  id="categoryId"
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                >
                  <option value="">Sem categoria</option>
                  {(categorias || []).map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  É por ela que o comerciante filtra a busca.
                </p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="promoPrice">Preço promocional (R$)</Label>
                  <Input
                    id="promoPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Opcional"
                    value={form.promoPrice}
                    onChange={(event) => setForm({ ...form, promoPrice: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promoUntil">Promoção válida até</Label>
                  <Input
                    id="promoUntil"
                    type="date"
                    value={form.promoUntil}
                    onChange={(event) => setForm({ ...form, promoUntil: event.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Depois dessa data o preço volta ao de tabela automaticamente.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="availability">Disponibilidade</Label>
                  <select
                    id="availability"
                    value={form.availability}
                    onChange={(event) =>
                      setForm({ ...form, availability: event.target.value as Availability })
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                  >
                    {(["disponivel", "sob_encomenda", "esgotado"] as const).map((valor) => (
                      <option key={valor} value={valor}>
                        {availabilityLabels[valor]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Estoque disponível</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Opcional"
                    value={form.stock}
                    onChange={(event) => setForm({ ...form, stock: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preço por quantidade</Label>
                <p className="text-xs text-muted-foreground">
                  Quanto mais o comerciante compra, menor o preço. A faixa alcançada vale no pedido.
                </p>
                {form.tiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      placeholder="A partir de"
                      value={tier.minQuantity}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          tiers: form.tiers.map((item, i) =>
                            i === index ? { ...item, minQuantity: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Preço (R$)"
                      value={tier.price}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          tiers: form.tiers.map((item, i) =>
                            i === index ? { ...item, price: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover faixa"
                      onClick={() =>
                        setForm({ ...form, tiers: form.tiers.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {form.tiers.length < 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({ ...form, tiers: [...form.tiers, { minQuantity: "", price: "" }] })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
                  </Button>
                )}
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
            <DialogFooter className="gap-2">
              {form.id &&
                (confirmandoRemocao ? (
                  <Button
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() => form.id && remove.mutate(form.id)}
                  >
                    Sim, tirar do catálogo
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => setConfirmandoRemocao(true)}
                  >
                    Remover do catálogo
                  </Button>
                ))}
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

      <p className="text-sm text-muted-foreground tabular-nums">
        <strong className="font-semibold text-foreground">{used}</strong>{" "}
        {used === 1 ? "item" : "itens"} no catálogo · limite do plano:{" "}
        {Number.isFinite(limit) ? limit : "ilimitado"}
      </p>

      {!data?.items.length ? (
        <Card className="p-8 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Seu catálogo está vazio.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione o que você fornece para aparecer nas comparações de preço.
          </p>
        </Card>
      ) : (
        // Lista, e não um cartão por item: no celular cada cartão ocupava meia tela, e
        // a lixeira no canto tirava o item do catálogo com um toque, sem perguntar —
        // o item some das comparações dos comerciantes na mesma hora. Remover agora
        // fica dentro da edição, com confirmação.
        <ul className="divide-y divide-border border-y border-border">
          {data.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => editar(item)}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">
                      {item.name}
                      {item.brand && (
                        <span className="font-normal text-muted-foreground"> · {item.brand}</span>
                      )}
                    </p>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {item.precoVigente === null ? "Sob consulta" : brl(item.precoVigente)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums">
                    <span>
                      {num(item.packSize, 3)} {baseUnitShort[item.baseUnit]}
                      {item.pricePerBaseUnit !== null &&
                        ` · ${brl(item.pricePerBaseUnit)}/${baseUnitShort[item.baseUnit]}`}
                    </span>
                    {item.promoPrice !== null &&
                      item.price !== null &&
                      item.precoVigente === item.promoPrice && (
                        <span className="font-medium text-success">
                          promoção (de {brl(item.price)})
                        </span>
                      )}
                    {item.availability !== "disponivel" && (
                      <span className="font-medium text-warning">
                        {availabilityLabels[item.availability]}
                      </span>
                    )}
                    {item.tiers.length > 0 && <span>{item.tiers.length} faixa(s) de preço</span>}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
