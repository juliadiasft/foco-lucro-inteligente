import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookmarkCheck,
  BookmarkPlus,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { sendMessage } from "@/lib/api/conversations.functions";
import { addSupplierFromDirectory, listSupplierDirectory } from "@/lib/api/marketplace.functions";
import { brl, num } from "@/lib/format";

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export function SupplierDirectory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyMySegments, setOnlyMySegments] = useState(true);
  const [uf, setUf] = useState("");

  const list = useMutation({
    mutationFn: () =>
      listSupplierDirectory({
        data: { search: search || undefined, onlyMySegments, uf: uf || undefined },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  // Carrega sozinho: o comerciante não precisa buscar nada para ver quem
  // atende o nicho dele.
  useEffect(() => {
    list.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adicionar = useMutation({
    mutationFn: (supplierCompanyId: string) =>
      addSupplierFromDirectory({ data: { supplierCompanyId } }),
    onSuccess: async () => {
      toast.success("Fornecedor adicionado à sua lista");
      list.mutate();
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const conversar = useMutation({
    mutationFn: (supplierCompanyId: string) =>
      sendMessage({
        data: {
          supplierCompanyId,
          body: "Olá! Encontrei vocês pela Central e gostaria de conhecer as condições.",
        },
      }),
    onSuccess: () => toast.success("Mensagem enviada. Veja em Conversas."),
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = list.data || [];

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_8rem_auto]">
          <Input
            placeholder="Buscar fornecedor pelo nome"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") list.mutate();
            }}
          />
          <select
            value={uf}
            onChange={(event) => setUf(event.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
          >
            <option value="">Todo o Brasil</option>
            {UFS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button disabled={list.isPending} onClick={() => list.mutate()}>
            <Search className="h-4 w-4 mr-1" />
            {list.isPending ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="nicho" checked={onlyMySegments} onCheckedChange={setOnlyMySegments} />
          <Label htmlFor="nicho" className="font-normal text-sm">
            Mostrar só fornecedores do meu nicho
          </Label>
        </div>
      </Card>

      {list.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_item, index) => (
            <Card key={index} className="h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : !rows.length ? (
        <Card className="p-8 text-center">
          <Truck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhum fornecedor publicado ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tente desligar o filtro de nicho. Você também pode cadastrar na aba ao lado um
            fornecedor que ainda não esteja na Central.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((supplier) => (
            <Card key={supplier.companyId} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold leading-tight">{supplier.name}</h3>
                  {supplier.nichos && (
                    <p className="text-xs text-muted-foreground">{supplier.nichos}</p>
                  )}
                </div>
                {supplier.naAgenda && (
                  <Badge variant="secondary" className="shrink-0">
                    Na sua lista
                  </Badge>
                )}
              </div>

              {supplier.description && (
                <p className="text-sm text-muted-foreground mt-2 flex-1">{supplier.description}</p>
              )}

              {/* Sinais de confiança: o comerciante está a ponto de mandar
                  dinheiro para uma empresa que ele nunca viu. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {supplier.nota !== null ? (
                  <span className="flex items-center gap-1 font-medium text-warning">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {num(supplier.nota, 1)}
                    <span className="text-muted-foreground font-normal">
                      ({supplier.avaliacoes})
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sem avaliações ainda</span>
                )}
                {supplier.pedidosConcluidos > 0 && (
                  <span className="flex items-center gap-1 text-success font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {num(supplier.pedidosConcluidos)} pedido(s) concluído(s)
                  </span>
                )}
                {supplier.taxaResposta !== null && (
                  <span className="text-muted-foreground">
                    Responde {num(supplier.taxaResposta, 0)}% dos orçamentos
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {supplier.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {supplier.city}
                    {supplier.uf ? ` — ${supplier.uf}` : ""}
                  </span>
                )}
                {supplier.deliveryDays !== null && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {supplier.deliveryDays} dia(s)
                  </span>
                )}
                {supplier.minimumOrder !== null && (
                  <span>Pedido mínimo {brl(supplier.minimumOrder)}</span>
                )}
                <span>{num(supplier.itens)} item(ns) no catálogo</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/comprar">Ver preços</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={conversar.isPending}
                  onClick={() => conversar.mutate(supplier.companyId)}
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> Conversar
                </Button>
                {supplier.naAgenda ? (
                  <Button size="sm" variant="ghost" disabled>
                    <BookmarkCheck className="h-4 w-4 mr-1" /> Já adicionado
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={adicionar.isPending}
                    onClick={() => adicionar.mutate(supplier.companyId)}
                  >
                    <BookmarkPlus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
