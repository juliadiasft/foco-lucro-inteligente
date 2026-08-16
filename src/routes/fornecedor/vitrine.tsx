import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getSupplierProfile, saveSupplierProfile } from "@/lib/api/supplier.functions";

export const Route = createFileRoute("/fornecedor/vitrine")({
  head: () => ({ meta: [{ title: "Minha vitrine — Central do Comerciante" }] }),
  component: VitrinePage,
});

function VitrinePage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["supplier-profile"],
    queryFn: () => getSupplierProfile(),
  });

  const [form, setForm] = useState({
    displayName: "",
    description: "",
    deliveryDays: "",
    minimumOrder: "",
    publicPhone: "",
    publicEmail: "",
    paymentTerms: "",
    commercialTerms: "",
    published: false,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      displayName: data.displayName,
      description: data.description || "",
      deliveryDays: data.deliveryDays === null ? "" : String(data.deliveryDays),
      minimumOrder: data.minimumOrder === null ? "" : String(data.minimumOrder),
      publicPhone: data.publicPhone || "",
      publicEmail: data.publicEmail || "",
      paymentTerms: data.paymentTerms || "",
      commercialTerms: data.commercialTerms || "",
      published: data.published,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveSupplierProfile({
        data: {
          displayName: form.displayName,
          description: form.description || undefined,
          deliveryDays: form.deliveryDays === "" ? null : Number(form.deliveryDays),
          minimumOrder: form.minimumOrder === "" ? null : Number(form.minimumOrder),
          publicPhone: form.publicPhone || undefined,
          publicEmail: form.publicEmail || "",
          paymentTerms: form.paymentTerms || undefined,
          commercialTerms: form.commercialTerms || undefined,
          published: form.published,
        },
      }),
    onSuccess: async () => {
      toast.success("Vitrine salva");
      await queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Minha vitrine</h1>
        <p className="text-muted-foreground mt-1">
          É o que o comerciante vê antes de decidir falar com você.
        </p>
      </div>

      <Card
        className={`p-5 flex flex-wrap items-center gap-4 ${
          form.published ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"
        }`}
      >
        {form.published ? (
          <Eye className="h-5 w-5 text-success" />
        ) : (
          <EyeOff className="h-5 w-5 text-warning" />
        )}
        <div className="flex-1 min-w-[14rem]">
          <p className="font-medium">
            {form.published ? "Sua vitrine está visível" : "Sua vitrine está oculta"}
          </p>
          <p className="text-sm text-muted-foreground">
            {form.published
              ? "Comerciantes dos seus nichos podem encontrar você na busca."
              : "Ninguém encontra você na busca enquanto estiver assim."}
          </p>
        </div>
        <Switch
          checked={form.published}
          onCheckedChange={(checked) => setForm({ ...form, published: checked })}
          aria-label="Publicar vitrine"
        />
      </Card>

      <Card className="p-6 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Nome que aparece para o comerciante</Label>
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">O que você fornece</Label>
          <Textarea
            id="description"
            rows={4}
            placeholder="Ex.: Distribuidora de rações e acessórios para pet shops, com entrega própria."
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="deliveryDays">Prazo de entrega (dias)</Label>
            <Input
              id="deliveryDays"
              type="number"
              min={0}
              placeholder="Ex.: 3"
              value={form.deliveryDays}
              onChange={(event) => setForm({ ...form, deliveryDays: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minimumOrder">Pedido mínimo (R$)</Label>
            <Input
              id="minimumOrder"
              type="number"
              min={0}
              step="0.01"
              placeholder="Ex.: 500"
              value={form.minimumOrder}
              onChange={(event) => setForm({ ...form, minimumOrder: event.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="publicPhone">Telefone público</Label>
            <Input
              id="publicPhone"
              value={form.publicPhone}
              onChange={(event) => setForm({ ...form, publicPhone: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="publicEmail">Email público</Label>
            <Input
              id="publicEmail"
              type="email"
              value={form.publicEmail}
              onChange={(event) => setForm({ ...form, publicEmail: event.target.value })}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Telefone e email ficam visíveis para os comerciantes. Deixe em branco se preferir só
          conversar pela Central.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="paymentTerms">Formas de pagamento</Label>
          <Input
            id="paymentTerms"
            placeholder="Ex.: Pix, boleto 28 dias, cartão em 3x"
            value={form.paymentTerms}
            onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Aparece na busca junto com o seu preço — é uma das primeiras coisas que o comerciante
            olha.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="commercialTerms">Condições comerciais</Label>
          <Textarea
            id="commercialTerms"
            rows={3}
            placeholder="Ex.: Frete grátis acima de R$ 1.000. Troca em até 7 dias. Desconto para pedido recorrente."
            value={form.commercialTerms}
            onChange={(event) => setForm({ ...form, commercialTerms: event.target.value })}
          />
        </div>

        <Button disabled={save.isPending || !form.displayName} onClick={() => save.mutate()}>
          {save.isPending ? "Salvando..." : "Salvar vitrine"}
        </Button>
      </Card>
    </div>
  );
}
