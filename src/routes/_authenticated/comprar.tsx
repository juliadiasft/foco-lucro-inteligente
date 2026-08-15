import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, FileText, MapPin, MessageSquare, Search, ShoppingCart, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FeatureLock, useFeature } from "@/components/app/FeatureLock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sendMessage } from "@/lib/api/conversations.functions";
import { searchSuppliers } from "@/lib/api/marketplace.functions";
import { createOrder } from "@/lib/api/orders.functions";
import { createQuoteRequest } from "@/lib/api/quotes.functions";
import { baseUnitShort } from "@/lib/catalog";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/comprar")({
  head: () => ({ meta: [{ title: "Onde comprar — Central do Comerciante" }] }),
  component: ComprarPage,
});

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

function ComprarPage() {
  const liberado = useFeature("comparacaoFornecedores");
  if (!liberado)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Onde comprar</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            A comparação lado a lado mostra quanto cada fornecedor cobra por quilo, litro ou
            unidade.
          </p>
        </div>
        <FeatureLock feature="comparacaoFornecedores" />
        <Card className="p-5">
          <p className="font-medium">Você continua encontrando fornecedores.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Em Fornecedores você vê quem atende o seu nicho, conversa, pede orçamento e faz pedido.
            O que entra no plano Profissional é a comparação de preços entre eles.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/fornecedores">Ver fornecedores</Link>
          </Button>
        </Card>
      </div>
    );
  return <ComprarConteudo />;
}

function ComprarConteudo() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [onlyMySegments, setOnlyMySegments] = useState(true);
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const [maxDeliveryDays, setMaxDeliveryDays] = useState("");

  const search = useMutation({
    mutationFn: () =>
      searchSuppliers({
        data: {
          term: term || undefined,
          onlyMySegments,
          uf: uf || undefined,
          city: city || undefined,
          maxDeliveryDays: maxDeliveryDays === "" ? null : Number(maxDeliveryDays),
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  // Primeira carga já mostra o que existe para o nicho do comerciante, sem
  // exigir que ele saiba o que procurar.
  useEffect(() => {
    search.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre a conversa já com a pergunta escrita: o comerciante compara e fala
  // com o fornecedor sem trocar de tela nem sair para outro aplicativo.
  const startConversation = useMutation({
    mutationFn: ({ supplierCompanyId, body }: { supplierCompanyId: string; body: string }) =>
      sendMessage({ data: { supplierCompanyId, body } }),
    onSuccess: () => {
      toast.success("Mensagem enviada");
      navigate({ to: "/conversas" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const order = useMutation({
    mutationFn: ({ offeringId, quantity }: { offeringId: string; quantity: number }) =>
      createOrder({ data: { offeringId, quantity } }),
    onSuccess: () => {
      toast.success("Pedido enviado ao fornecedor");
      navigate({ to: "/pedidos" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orcamento = useMutation({
    mutationFn: (payload: Parameters<typeof createQuoteRequest>[0]["data"]) =>
      createQuoteRequest({ data: payload }),
    onSuccess: () => {
      toast.success("Orçamento enviado ao fornecedor");
      navigate({ to: "/orcamentos" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const results = search.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Onde comprar</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Comparamos pelo preço por {baseUnitShort.kg}, {baseUnitShort.l} ou unidade — não pelo
          preço da caixa. Uma embalagem maior nem sempre é mais barata.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="term">O que você quer comprar</Label>
            <Input
              id="term"
              placeholder="Ex.: ração, refrigerante, papel higiênico"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search.mutate();
              }}
            />
          </div>
          <div className="flex items-end">
            <Button size="lg" disabled={search.isPending} onClick={() => search.mutate()}>
              <Search className="h-4 w-4 mr-1" />
              {search.isPending ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="uf">Estado</Label>
            <select
              id="uf"
              value={uf}
              onChange={(event) => setUf(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            >
              <option value="">Todos</option>
              {UFS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              placeholder="Todas"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxDeliveryDays">Entrega em até (dias)</Label>
            <Input
              id="maxDeliveryDays"
              type="number"
              min={0}
              placeholder="Sem limite"
              value={maxDeliveryDays}
              onChange={(event) => setMaxDeliveryDays(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="onlyMySegments"
            checked={onlyMySegments}
            onCheckedChange={setOnlyMySegments}
          />
          <Label htmlFor="onlyMySegments" className="font-normal text-sm">
            Mostrar só fornecedores do meu nicho
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Fornecedor de longe continua aparecendo. Use os filtros se preferir comprar perto ou
          receber mais rápido.
        </p>
      </Card>

      {search.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_item, index) => (
            <Card key={index} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : !results.length ? (
        <Card className="p-8 text-center">
          <Search className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhum fornecedor encontrado.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ainda há poucos fornecedores publicados. Tente desligar o filtro de nicho ou buscar
            outro produto.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <Card key={item.itemId} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  {item.brand && <p className="text-sm text-muted-foreground">{item.brand}</p>}
                </div>
                {item.savingsPerBaseUnit !== null && (
                  <Badge className="bg-success/15 text-success border-success/30">
                    Economia de {brl(item.savingsPerBaseUnit)}/{baseUnitShort[item.baseUnit]} (
                    {num(item.savingsPercent, 1)}%)
                  </Badge>
                )}
              </div>

              <ul className="mt-4 divide-y">
                {item.offers.map((offer, index) => (
                  <li
                    key={offer.offeringId}
                    className={`py-3 flex flex-wrap items-center gap-x-6 gap-y-2 ${
                      index === 0 && offer.pricePerBaseUnit !== null ? "" : "opacity-90"
                    }`}
                  >
                    <div className="flex-1 min-w-[12rem]">
                      <p className="font-medium flex items-center gap-2">
                        {index === 0 && offer.pricePerBaseUnit !== null && (
                          <Award className="h-4 w-4 text-success" />
                        )}
                        {offer.supplierName}
                      </p>
                      <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        {offer.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {offer.city}
                            {offer.uf ? ` — ${offer.uf}` : ""}
                          </span>
                        )}
                        {offer.deliveryDays !== null && (
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {offer.deliveryDays} dia(s)
                          </span>
                        )}
                        {offer.minimumOrder !== null && (
                          <span>Pedido mínimo {brl(offer.minimumOrder)}</span>
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      {offer.pricePerBaseUnit === null ? (
                        <p className="font-semibold text-muted-foreground">Sob consulta</p>
                      ) : (
                        <>
                          <p className="text-xl font-bold">
                            {brl(offer.pricePerBaseUnit)}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{baseUnitShort[item.baseUnit]}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {brl(offer.price)} a embalagem de {num(offer.packSize, 3)}{" "}
                            {baseUnitShort[item.baseUnit]}
                          </p>
                        </>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={startConversation.isPending}
                      onClick={() =>
                        startConversation.mutate({
                          supplierCompanyId: offer.supplierCompanyId,
                          body: `Olá! Tenho interesse em ${item.name}${
                            item.brand ? ` (${item.brand})` : ""
                          }, embalagem de ${num(offer.packSize, 3)} ${
                            baseUnitShort[item.baseUnit]
                          }. Pode me passar as condições?`,
                        })
                      }
                    >
                      <MessageSquare className="h-4 w-4 mr-1" /> Conversar
                    </Button>

                    {offer.price !== null && (
                      <Button
                        size="sm"
                        disabled={order.isPending}
                        onClick={() => {
                          const answer = window.prompt(
                            `Quantas embalagens de ${num(offer.packSize, 3)} ${
                              baseUnitShort[item.baseUnit]
                            }? (mínimo ${num(offer.minimumQuantity, 3)})`,
                            String(offer.minimumQuantity),
                          );
                          if (answer === null) return;
                          const quantity = Number(answer.replace(",", "."));
                          if (!Number.isFinite(quantity) || quantity <= 0)
                            return toast.error("Informe uma quantidade válida");
                          order.mutate({ offeringId: offer.offeringId, quantity });
                        }}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" /> Pedir
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant={offer.price === null ? "default" : "outline"}
                      disabled={orcamento.isPending}
                      onClick={() => {
                        const answer = window.prompt(
                          `Quantas embalagens de ${num(offer.packSize, 3)} ${
                            baseUnitShort[item.baseUnit]
                          } você quer cotar?`,
                          String(offer.minimumQuantity),
                        );
                        if (answer === null) return;
                        const quantity = Number(answer.replace(",", "."));
                        if (!Number.isFinite(quantity) || quantity <= 0)
                          return toast.error("Informe uma quantidade válida");
                        orcamento.mutate({
                          supplierCompanyId: offer.supplierCompanyId,
                          items: [
                            {
                              offeringId: offer.offeringId,
                              itemName: item.name,
                              brand: item.brand || undefined,
                              baseUnit: item.baseUnit,
                              packSize: offer.packSize,
                              quantity,
                            },
                          ],
                        });
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" /> Pedir orçamento
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
