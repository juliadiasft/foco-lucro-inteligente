import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Award,
  ChevronRight,
  FileText,
  MapPin,
  MessageSquare,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FeatureLock, useFeature } from "@/components/app/FeatureLock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sendMessage } from "@/lib/api/conversations.functions";
import { reportSupplierLead, searchSuppliers } from "@/lib/api/marketplace.functions";
import { createOrder } from "@/lib/api/orders.functions";
import { createQuoteRequest } from "@/lib/api/quotes.functions";
import { listCategories } from "@/lib/api/supplier.functions";
import { availabilityLabels, baseUnitShort } from "@/lib/catalog";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/comprar")({
  head: () => ({ meta: [{ title: "Onde comprar — Central do Comerciante" }] }),
  component: ComprarPage,
});

// A tela abre com preço, e não com formulário.
//
// Antes a primeira tela do celular era só filtro — busca, estado, cidade,
// prazo, categoria e dois interruptores — e a primeira oferta só aparecia
// depois de rolar tudo isso. Cada oferta trazia ainda três botões, e a
// quantidade era pedida na caixinha cinza do navegador.
// Agora: busca em cima, filtros atrás de um botão, e a oferta é uma linha que
// se toca para abrir a folha com as condições, a quantidade e o que fazer.

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

type Filtros = {
  term: string;
  onlyMySegments: boolean;
  uf: string;
  city: string;
  maxDeliveryDays: string;
  categoryId: string;
  onlyAvailable: boolean;
};

// O nicho já vem ligado: quem abre a tela quer ver o que serve para a loja
// dele, não o mercado inteiro.
const PADRAO: Filtros = {
  term: "",
  onlyMySegments: true,
  uf: "",
  city: "",
  maxDeliveryDays: "",
  categoryId: "",
  onlyAvailable: false,
};

type Resultado = Awaited<ReturnType<typeof searchSuppliers>>[number];
type Oferta = Resultado["offers"][number];
type Escolha = { item: Resultado; offer: Oferta };

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
  // Os filtros valendo e os que a pessoa está mexendo na gaveta são coisas
  // diferentes: mexer num select não pode disparar busca a cada toque.
  const [filtros, setFiltros] = useState<Filtros>(PADRAO);
  const [rascunho, setRascunho] = useState<Filtros>(PADRAO);
  const [gaveta, setGaveta] = useState(false);
  const [escolha, setEscolha] = useState<Escolha | null>(null);

  const { data: categorias } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
    staleTime: 60 * 60 * 1000,
  });

  // A busca recebe os filtros por parâmetro em vez de ler o estado: quem
  // remove uma etiqueta já manda o valor novo, sem esperar o React repintar.
  const search = useMutation({
    mutationFn: (f: Filtros) =>
      searchSuppliers({
        data: {
          term: f.term.trim() || undefined,
          onlyMySegments: f.onlyMySegments,
          uf: f.uf || undefined,
          city: f.city.trim() || undefined,
          maxDeliveryDays: f.maxDeliveryDays === "" ? null : Number(f.maxDeliveryDays),
          categoryId: f.categoryId || undefined,
          onlyAvailable: f.onlyAvailable,
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  const buscar = (f: Filtros) => {
    setFiltros(f);
    setRascunho(f);
    search.mutate(f);
  };

  // Primeira carga já mostra o que existe para o nicho do comerciante, sem
  // exigir que ele saiba o que procurar.
  useEffect(() => {
    search.mutate(PADRAO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre a conversa já com a pergunta escrita: o comerciante compara e fala
  // com o fornecedor sem trocar de tela nem sair para outro aplicativo.
  const startConversation = useMutation({
    mutationFn: ({ supplierCompanyId, body }: { supplierCompanyId: string; body: string }) =>
      sendMessage({ data: { supplierCompanyId, body } }),
    // Cai direto na conversa que acabou de começar, e não na lista: a pessoa
    // acabou de mandar a pergunta e quer ver a resposta chegar ali.
    onSuccess: ({ conversationId }) => {
      setEscolha(null);
      toast.success("Mensagem enviada");
      navigate({ to: "/conversas", search: { aberto: conversationId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const order = useMutation({
    mutationFn: ({ offeringId, quantity }: { offeringId: string; quantity: number }) =>
      createOrder({ data: { offeringId, quantity } }),
    onSuccess: () => {
      setEscolha(null);
      toast.success("Pedido enviado ao fornecedor");
      navigate({ to: "/pedidos" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orcamento = useMutation({
    mutationFn: (payload: Parameters<typeof createQuoteRequest>[0]["data"]) =>
      createQuoteRequest({ data: payload }),
    onSuccess: ({ id }) => {
      setEscolha(null);
      toast.success("Orçamento enviado ao fornecedor");
      navigate({ to: "/orcamentos", search: { aberto: id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const results = search.data || [];
  const nomeDaCategoria = (categorias || []).find((c) => c.id === filtros.categoryId)?.name;

  // Cada etiqueta guarda como desfazer a si mesma.
  const etiquetas: { chave: string; texto: string; limpar: Filtros }[] = [];
  if (filtros.onlyMySegments)
    etiquetas.push({
      chave: "nicho",
      texto: "Só do meu nicho",
      limpar: { ...filtros, onlyMySegments: false },
    });
  if (filtros.uf)
    etiquetas.push({ chave: "uf", texto: filtros.uf, limpar: { ...filtros, uf: "" } });
  if (filtros.city)
    etiquetas.push({ chave: "city", texto: filtros.city, limpar: { ...filtros, city: "" } });
  if (filtros.maxDeliveryDays)
    etiquetas.push({
      chave: "prazo",
      texto: `Até ${filtros.maxDeliveryDays} dia(s)`,
      limpar: { ...filtros, maxDeliveryDays: "" },
    });
  if (nomeDaCategoria)
    etiquetas.push({
      chave: "categoria",
      texto: nomeDaCategoria,
      limpar: { ...filtros, categoryId: "" },
    });
  if (filtros.onlyAvailable)
    etiquetas.push({
      chave: "pronta",
      texto: "Pronta entrega",
      limpar: { ...filtros, onlyAvailable: false },
    });

  return (
    // Lista de leitura tem largura de leitura: esticada no monitor inteiro, o
    // preço acabava a meio metro do nome do fornecedor.
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold md:text-3xl">Onde comprar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Preço por {baseUnitShort.kg}, {baseUnitShort.l} ou unidade — a embalagem maior nem sempre
          sai mais barata.
        </p>
      </div>

      {/* Busca e filtros numa linha só. O filtro é a exceção, não a porta de
          entrada: quem abre a tela quer ver oferta. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="O que você quer comprar"
            placeholder="Ração, areia, shampoo..."
            className="h-11 pl-9"
            value={filtros.term}
            onChange={(event) => setFiltros({ ...filtros, term: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
                buscar(filtros);
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          className="h-11 shrink-0"
          onClick={() => {
            setRascunho(filtros);
            setGaveta(true);
          }}
        >
          <SlidersHorizontal className="h-4 w-4 md:mr-1.5" />
          <span className="hidden md:inline">Filtros</span>
          {etiquetas.length > 0 && (
            <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {etiquetas.length}
            </span>
          )}
        </Button>
      </div>

      {etiquetas.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {etiquetas.map((etiqueta) => (
            <button
              key={etiqueta.chave}
              type="button"
              onClick={() => buscar(etiqueta.limpar)}
              className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              {etiqueta.texto}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {search.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_item, index) => (
            <div key={index} className="h-32 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : !results.length ? (
        <IndicarFornecedor termo={filtros.term} />
      ) : (
        <div className="space-y-7">
          {results.map((item) => (
            <section key={item.itemId}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="font-semibold leading-tight">
                  {item.name}
                  {item.brand && (
                    <span className="font-normal text-muted-foreground"> · {item.brand}</span>
                  )}
                </h2>
                {item.savingsPerBaseUnit !== null && (
                  <span className="text-xs font-semibold text-success">
                    economia de {brl(item.savingsPerBaseUnit)}/{baseUnitShort[item.baseUnit]} (
                    {num(item.savingsPercent, 1)}%)
                  </span>
                )}
              </div>

              {/* Uma linha por fornecedor, a primeira marcada. O que era três
                  botões por linha virou um toque na linha inteira. */}
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {item.offers.map((offer, index) => {
                  const melhor = index === 0 && offer.pricePerBaseUnit !== null;
                  return (
                    <li key={offer.offeringId}>
                      <button
                        type="button"
                        onClick={() => setEscolha({ item, offer })}
                        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-medium leading-snug">
                            {melhor && <Award className="h-4 w-4 shrink-0 text-success" />}
                            <span className="truncate">{offer.supplierName}</span>
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
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
                            {offer.availability !== "disponivel" && (
                              <span className="font-medium text-warning">
                                {availabilityLabels[offer.availability]}
                              </span>
                            )}
                            {offer.emPromocao && (
                              <span className="font-medium text-success">Promoção</span>
                            )}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          {offer.pricePerBaseUnit === null ? (
                            <p className="text-sm font-semibold text-muted-foreground">
                              Sob consulta
                            </p>
                          ) : (
                            <>
                              <p
                                className={`tabular-nums ${melhor ? "text-lg font-bold" : "font-semibold"}`}
                              >
                                {brl(offer.pricePerBaseUnit)}
                                <span className="text-xs font-normal text-muted-foreground">
                                  /{baseUnitShort[item.baseUnit]}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {brl(offer.price)} · {num(offer.packSize, 3)}{" "}
                                {baseUnitShort[item.baseUnit]}
                              </p>
                            </>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <GavetaDeFiltros
        aberta={gaveta}
        fechar={() => setGaveta(false)}
        rascunho={rascunho}
        mudar={setRascunho}
        categorias={categorias || []}
        aplicar={() => {
          setGaveta(false);
          buscar(rascunho);
        }}
        limpar={() => {
          setGaveta(false);
          buscar({ ...PADRAO, term: filtros.term });
        }}
      />

      <Drawer open={Boolean(escolha)} onOpenChange={(aberta) => !aberta && setEscolha(null)}>
        <DrawerContent className="max-h-[92vh]">
          {escolha && (
            <FolhaDaOferta
              key={escolha.offer.offeringId}
              escolha={escolha}
              ocupado={order.isPending || orcamento.isPending || startConversation.isPending}
              aoPedir={(quantity) =>
                order.mutate({ offeringId: escolha.offer.offeringId, quantity })
              }
              aoCotar={(quantity) =>
                orcamento.mutate({
                  supplierCompanyId: escolha.offer.supplierCompanyId,
                  items: [
                    {
                      offeringId: escolha.offer.offeringId,
                      itemName: escolha.item.name,
                      brand: escolha.item.brand || undefined,
                      baseUnit: escolha.item.baseUnit,
                      packSize: escolha.offer.packSize,
                      quantity,
                    },
                  ],
                })
              }
              aoConversar={() =>
                startConversation.mutate({
                  supplierCompanyId: escolha.offer.supplierCompanyId,
                  body: `Olá! Tenho interesse em ${escolha.item.name}${
                    escolha.item.brand ? ` (${escolha.item.brand})` : ""
                  }, embalagem de ${num(escolha.offer.packSize, 3)} ${
                    baseUnitShort[escolha.item.baseUnit]
                  }. Pode me passar as condições?`,
                })
              }
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function GavetaDeFiltros({
  aberta,
  fechar,
  rascunho,
  mudar,
  categorias,
  aplicar,
  limpar,
}: {
  aberta: boolean;
  fechar: () => void;
  rascunho: Filtros;
  mudar: (f: Filtros) => void;
  categorias: { id: string; name: string }[];
  aplicar: () => void;
  limpar: () => void;
}) {
  const classeSelect =
    "h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs";
  return (
    <Drawer open={aberta} onOpenChange={(estado) => !estado && fechar()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Filtros</DrawerTitle>
          <DrawerDescription>
            Fornecedor de longe continua aparecendo. Filtre se preferir comprar perto ou receber
            mais rápido.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="uf">Estado</Label>
              <select
                id="uf"
                value={rascunho.uf}
                onChange={(event) => mudar({ ...rascunho, uf: event.target.value })}
                className={classeSelect}
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
                className="h-11"
                placeholder="Todas"
                value={rascunho.city}
                onChange={(event) => mudar({ ...rascunho, city: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Categoria</Label>
            <select
              id="categoryId"
              value={rascunho.categoryId}
              onChange={(event) => mudar({ ...rascunho, categoryId: event.target.value })}
              className={classeSelect}
            >
              <option value="">Todas</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxDeliveryDays">Entrega em até (dias)</Label>
            <Input
              id="maxDeliveryDays"
              type="number"
              inputMode="numeric"
              min={0}
              className="h-11"
              placeholder="Sem limite"
              value={rascunho.maxDeliveryDays}
              onChange={(event) => mudar({ ...rascunho, maxDeliveryDays: event.target.value })}
            />
          </div>

          <label className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm">Mostrar só fornecedores do meu nicho</span>
            <Switch
              checked={rascunho.onlyMySegments}
              onCheckedChange={(valor) => mudar({ ...rascunho, onlyMySegments: valor })}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm">Só pronta entrega</span>
            <Switch
              checked={rascunho.onlyAvailable}
              onCheckedChange={(valor) => mudar({ ...rascunho, onlyAvailable: valor })}
            />
          </label>
        </div>

        <DrawerFooter>
          <Button size="lg" onClick={aplicar}>
            Ver resultados
          </Button>
          <Button variant="ghost" onClick={limpar}>
            Limpar filtros
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// A quantidade era pedida pela caixa cinza do navegador, sem saber o total nem
// o pedido mínimo. Aqui ela fica junto do preço, e a conta aparece antes de
// mandar.
function FolhaDaOferta({
  escolha,
  ocupado,
  aoPedir,
  aoCotar,
  aoConversar,
}: {
  escolha: Escolha;
  ocupado: boolean;
  aoPedir: (quantidade: number) => void;
  aoCotar: (quantidade: number) => void;
  aoConversar: () => void;
}) {
  const { item, offer } = escolha;
  const minimo = offer.minimumQuantity > 0 ? offer.minimumQuantity : 1;
  // O fornecedor tem dois mínimos: de embalagens e de valor. Abrir na conta que
  // já satisfaz os dois evita a folha nascer com um aviso vermelho — o pedido
  // mínimo de R$ 200,00 nunca cabe numa embalagem de R$ 60,00.
  const porValor =
    offer.minimumOrder !== null && offer.price
      ? Math.ceil(offer.minimumOrder / offer.price)
      : minimo;
  const [quantidade, setQuantidade] = useState(Math.max(minimo, porValor));
  const unidade = baseUnitShort[item.baseUnit];
  const total = offer.price === null ? null : offer.price * quantidade;
  const abaixoDoMinimo =
    total !== null && offer.minimumOrder !== null && total < offer.minimumOrder;

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="leading-snug">
          {item.name}
          {item.brand ? ` · ${item.brand}` : ""}
        </DrawerTitle>
        <DrawerDescription>
          {offer.supplierName}
          {offer.city ? ` — ${offer.city}${offer.uf ? `/${offer.uf}` : ""}` : ""}
        </DrawerDescription>
      </DrawerHeader>

      <div className="space-y-4 overflow-y-auto px-4">
        <div className="flex items-end justify-between gap-3 border-y border-border py-3">
          <div>
            {offer.pricePerBaseUnit === null ? (
              <p className="text-lg font-semibold text-muted-foreground">Preço sob consulta</p>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {brl(offer.pricePerBaseUnit)}
                  <span className="text-sm font-normal text-muted-foreground">/{unidade}</span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {brl(offer.price)} a embalagem de {num(offer.packSize, 3)} {unidade}
                </p>
              </>
            )}
          </div>
          {offer.emPromocao && (
            <Badge className="border-success/30 bg-success/15 text-success">Promoção</Badge>
          )}
        </div>

        <dl className="space-y-1.5 text-sm">
          {offer.deliveryDays !== null && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Entrega</dt>
              <dd>{offer.deliveryDays} dia(s)</dd>
            </div>
          )}
          {offer.minimumOrder !== null && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Pedido mínimo</dt>
              <dd className="tabular-nums">{brl(offer.minimumOrder)}</dd>
            </div>
          )}
          {offer.paymentTerms && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Pagamento</dt>
              <dd>{offer.paymentTerms}</dd>
            </div>
          )}
          {offer.availability !== "disponivel" && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Disponibilidade</dt>
              <dd className="font-medium text-warning">{availabilityLabels[offer.availability]}</dd>
            </div>
          )}
        </dl>

        <div className="border-t border-border pt-4">
          <Label htmlFor="quantidade">
            Quantas embalagens de {num(offer.packSize, 3)} {unidade}
          </Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 text-lg"
              aria-label="Menos uma embalagem"
              disabled={quantidade <= minimo}
              onClick={() => setQuantidade(Math.max(minimo, quantidade - 1))}
            >
              −
            </Button>
            <Input
              id="quantidade"
              type="number"
              inputMode="decimal"
              min={minimo}
              className="h-11 text-center text-base tabular-nums"
              value={quantidade}
              onChange={(event) => {
                const valor = Number(event.target.value.replace(",", "."));
                setQuantidade(Number.isFinite(valor) && valor > 0 ? valor : minimo);
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 text-lg"
              aria-label="Mais uma embalagem"
              onClick={() => setQuantidade(quantidade + 1)}
            >
              +
            </Button>
          </div>
          {total !== null && (
            <p className="mt-2 text-sm">
              Total <strong className="font-semibold tabular-nums">{brl(total)}</strong> ·{" "}
              {num(quantidade * offer.packSize, 3)} {unidade}
            </p>
          )}
          {!abaixoDoMinimo && porValor > minimo && (
            <p className="mt-1 text-xs text-muted-foreground">
              Começa em {num(porValor)} porque o pedido mínimo é {brl(offer.minimumOrder)}.
            </p>
          )}
          {!abaixoDoMinimo && porValor <= minimo && minimo > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Mínimo de {num(minimo)} embalagem(ns) neste fornecedor.
            </p>
          )}
          {abaixoDoMinimo && (
            <p className="mt-1 text-xs font-medium text-warning">
              Abaixo do pedido mínimo de {brl(offer.minimumOrder)}. O fornecedor pode recusar.
            </p>
          )}
        </div>
      </div>

      <DrawerFooter>
        {offer.price !== null && (
          <Button size="lg" disabled={ocupado} onClick={() => aoPedir(quantidade)}>
            <ShoppingCart className="mr-1.5 h-4 w-4" /> Fazer pedido
          </Button>
        )}
        <Button
          size="lg"
          variant={offer.price === null ? "default" : "outline"}
          disabled={ocupado}
          onClick={() => aoCotar(quantidade)}
        >
          <FileText className="mr-1.5 h-4 w-4" /> Pedir orçamento
        </Button>
        <Button variant="ghost" disabled={ocupado} onClick={aoConversar}>
          <MessageSquare className="mr-1.5 h-4 w-4" /> Conversar com o fornecedor
        </Button>
      </DrawerFooter>
    </>
  );
}

// Busca sem resultado costumava terminar aqui, num aviso e nada a fazer. Agora
// o comerciante conta de quem ele compra hoje: ele sai tendo feito algo, e a
// Central passa a saber quais fornecedores ja tem gente esperando por eles.
function IndicarFornecedor({ termo }: { termo: string }) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [produtos, setProdutos] = useState("");
  const [enviado, setEnviado] = useState(false);

  const indicar = useMutation({
    mutationFn: () =>
      reportSupplierLead({
        data: {
          supplierName: nome.trim(),
          city: cidade.trim() || undefined,
          products: produtos.trim() || undefined,
          searchTerm: termo.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setEnviado(true);
      setNome("");
      setCidade("");
      setProdutos("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (enviado) {
    return (
      <Card className="p-8 text-center">
        <Award className="h-8 w-8 mx-auto text-success" />
        <p className="font-medium mt-3">Anotado. Obrigado.</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg mx-auto">
          Vamos procurar esse fornecedor. Quando ele publicar os preços aqui, você recebe um aviso e
          passa a comparar sem precisar ligar para ninguém.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setEnviado(false)}>
          Indicar outro
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="text-center">
        <Search className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="font-medium mt-3">Nenhum fornecedor encontrado.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Ainda há poucos fornecedores publicados. Tente desligar o filtro de nicho — ou nos diga de
          quem você compra hoje, para irmos buscar essa empresa.
        </p>
      </div>

      <div className="mt-6 max-w-xl mx-auto space-y-4">
        <div>
          <Label htmlFor="lead-nome">De quem você compra hoje?</Label>
          <Input
            id="lead-nome"
            value={nome}
            maxLength={160}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nome do fornecedor ou distribuidora"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-cidade">Cidade dele (opcional)</Label>
            <Input
              id="lead-cidade"
              value={cidade}
              maxLength={120}
              onChange={(event) => setCidade(event.target.value)}
              placeholder="Deixe em branco se for da sua cidade"
            />
          </div>
          <div>
            <Label htmlFor="lead-produtos">O que você compra dele (opcional)</Label>
            <Input
              id="lead-produtos"
              value={produtos}
              maxLength={300}
              onChange={(event) => setProdutos(event.target.value)}
              placeholder="Ex.: ração, areia, brinquedos"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Não contamos ao fornecedor quem o indicou.
          </span>
          <Button
            disabled={nome.trim().length < 2 || indicar.isPending}
            onClick={() => indicar.mutate()}
          >
            {indicar.isPending ? "Enviando..." : "Indicar fornecedor"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
