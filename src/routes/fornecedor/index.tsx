import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, FileText, MessageSquare, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listConversations } from "@/lib/api/conversations.functions";
import { listOrders } from "@/lib/api/orders.functions";
import { listQuotes } from "@/lib/api/quotes.functions";
import {
  getCompanyProfile,
  listSegments,
  updateCompanyProfile,
} from "@/lib/api/segments.functions";
import { listReceivedReviews } from "@/lib/api/reviews.functions";
import { getSalesInsights } from "@/lib/api/insights.functions";
import { getPrecosAcimaDaRegiao, getPrimeiroDiaDoFornecedor } from "@/lib/api/supplier.functions";
import { InsightsPanel } from "@/components/app/InsightsPanel";
import { PrimeiroDiaDoFornecedor } from "@/components/app/PrimeiroDiaDoFornecedor";
import { ehPrimeiroDia } from "@/lib/primeiro-dia";
import { brl, num, quandoNaLista } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fornecedor/")({
  head: () => ({ meta: [{ title: "Painel do fornecedor — Central do Comerciante" }] }),
  component: SupplierHome,
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

// O Painel do fornecedor abre com o que está esperando por ele.
//
// Antes: "Olá, fornecedor!", os números de venda, três cartões sobre o
// cadastro, um formulário inteiro de nichos e cidade, e as avaliações — 3,6
// telas de celular. O pedido novo esperando aceite aparecia como "0 novo(s)
// esperando" numa linha miúda do terceiro cartão, e o orçamento para responder
// e a mensagem não lida não apareciam em lugar nenhum. Para quem vende, a
// primeira pergunta ao abrir é "tem cliente me esperando?".
function SupplierHome() {
  const { data: profile } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => getCompanyProfile(),
  });
  const { data: avaliacoes } = useQuery({
    queryKey: ["received-reviews"],
    queryFn: () => listReceivedReviews(),
  });
  const { data: vendas } = useQuery({
    queryKey: ["sales-insights"],
    queryFn: () => getSalesInsights(),
  });
  const primeiroDia = useQuery({
    queryKey: ["primeiro-dia-fornecedor"],
    queryFn: () => getPrimeiroDiaDoFornecedor(),
  });
  const precosNaRegiao = useQuery({
    queryKey: ["precos-acima-da-regiao"],
    queryFn: () => getPrecosAcimaDaRegiao(),
  });
  // As mesmas chaves das telas de Pedidos, Orçamentos e Conversas: o que é
  // resolvido lá some daqui sem precisar recarregar.
  const pedidos = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const orcamentos = useQuery({ queryKey: ["quotes"], queryFn: () => listQuotes() });
  const conversas = useQuery({ queryKey: ["conversations"], queryFn: () => listConversations() });
  const [editando, setEditando] = useState(false);

  const novosPedidos = (pedidos.data?.orders || []).filter((p) => p.status === "enviado");
  const orcamentosEsperando = (orcamentos.data?.quotes || []).filter((q) => q.minhaVez);
  const naoLidas = (conversas.data || []).filter((c) => c.unread > 0);
  const carregando = pedidos.isLoading || orcamentos.isLoading || conversas.isLoading;
  const esperando = novosPedidos.length + orcamentosEsperando.length + naoLidas.length;

  // Enquanto o fornecedor não pode ser encontrado — sem catálogo ou sem
  // vitrine publicada —, "Precisa de você" mostrando vazio não ajuda ninguém.
  // O painel de primeiro dia substitui esse vazio por instrução com motivo.
  if (primeiroDia.data && ehPrimeiroDia(primeiroDia.data)) {
    return (
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">Bem-vindo à Central</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Três passos para os comerciantes te encontrarem.
          </p>
        </div>
        <PrimeiroDiaDoFornecedor {...primeiroDia.data} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="flex items-center gap-2 text-xl font-bold md:text-3xl">
          Precisa de você
          {esperando > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold text-primary-foreground tabular-nums">
              {esperando}
            </span>
          )}
        </h1>
        {carregando ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }).map((_item, indice) => (
              <div key={indice} className="h-12 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : !esperando ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhum cliente esperando agora. Pedidos novos, orçamentos para responder e mensagens
            aparecem aqui assim que chegarem.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {novosPedidos.map((pedido) => (
              <Linha
                key={`p-${pedido.id}`}
                icone={ClipboardList}
                titulo={`Pedido novo de ${pedido.counterpartName}`}
                detalhe={`${num(pedido.quantity)} × ${pedido.itemName} · ${brl(pedido.total)}`}
                quando={pedido.createdAt}
                link={{ to: "/fornecedor/pedidos" }}
              />
            ))}
            {orcamentosEsperando.map((orcamento) => (
              <Linha
                key={`o-${orcamento.id}`}
                icone={FileText}
                titulo={
                  orcamento.ultimoTotal === null
                    ? `${orcamento.counterpartName} pediu orçamento`
                    : `${orcamento.counterpartName} respondeu sua proposta`
                }
                detalhe={
                  orcamento.ultimoTotal === null
                    ? `${num(orcamento.itens)} item(ns) esperando seu preço`
                    : `Contraproposta de ${brl(orcamento.ultimoTotal)}`
                }
                quando={orcamento.createdAt}
                link={{ to: "/fornecedor/orcamentos", search: { aberto: orcamento.id } }}
              />
            ))}
            {naoLidas.map((conversa) => (
              <Linha
                key={`c-${conversa.id}`}
                icone={MessageSquare}
                titulo={`${conversa.counterpartName} mandou ${conversa.unread === 1 ? "mensagem" : `${conversa.unread} mensagens`}`}
                detalhe={conversa.lastBody || ""}
                quando={conversa.lastMessageAt}
                link={{ to: "/fornecedor/conversas", search: { aberto: conversa.id } }}
              />
            ))}
          </ul>
        )}
      </section>

      {Boolean(precosNaRegiao.data?.itens.length) && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Seus preços acima da região
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Comparado com a mediana das tabelas dos outros fornecedores
            {precosNaRegiao.data?.regiao ? ` de ${precosNaRegiao.data.regiao}` : ""} — é o que eles
            publicam, não o que fecharam.
          </p>
          <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
            {precosNaRegiao.data?.itens.map((item) => (
              <li key={item.item} className="flex flex-wrap justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.item}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Você cobra {brl(item.meuPreco)}/{item.unidade} · a região,{" "}
                    {brl(item.medianaDosOutros)}/{item.unidade} ({item.concorrentes} fornecedores)
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-warning tabular-nums">
                  {brl(item.diferenca)} acima (+{num(item.percentual, 0)}%)
                </span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/fornecedor/catalogo">Ajustar preços</Link>
          </Button>
        </section>
      )}

      <InsightsPanel data={vendas} side="fornecedor" />

      {/* O cadastro é consultado de vez em quando, não todo dia: virou uma
          linha de resumo, e o formulário abre numa folha. */}
      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Como os comerciantes te encontram
            </h2>
            <p className="mt-1 text-sm">
              {profile?.segments.length
                ? profile.segments.map((segment) => segment.name).join(", ")
                : "Nenhum nicho escolhido"}
              {" · "}
              {profile?.city
                ? `${profile.city}${profile.uf ? ` — ${profile.uf}` : ""}`
                : "cidade não informada"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {num(profile?.audienceCount)} comerciante(s) desses nichos já na Central. Você aparece
              para todo o país; a cidade ajuda quem prefere comprar perto.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setEditando(true)}
          >
            Editar
          </Button>
        </div>
        {!profile?.segments.length && profile && (
          <p className="mt-2 text-sm font-medium text-warning">
            Sem nicho escolhido, nenhum comerciante encontra você na busca.
          </p>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Star className="h-4 w-4 text-warning" /> Avaliações
        </h2>
        {avaliacoes?.total ? (
          <>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {num(avaliacoes.media, 1)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                de 5 · {avaliacoes.total} avaliação(ões)
              </span>
            </p>
            <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
              {avaliacoes.reviews.slice(0, 5).map((review, index) => (
                <li key={index} className="py-2.5">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="text-warning">{"★".repeat(review.rating)}</span>
                    {review.autor}
                  </p>
                  {review.comment && (
                    <p className="mt-0.5 text-muted-foreground">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Ainda não há avaliações. O comerciante vê quantos pedidos você concluiu e quantos
            orçamentos responde — cumprir prazo e responder rápido é o que constrói sua reputação.
          </p>
        )}
      </section>

      <Drawer open={editando} onOpenChange={(estado) => !estado && setEditando(false)}>
        <DrawerContent className="max-h-[92vh]">
          {editando && profile && (
            <EditarCadastro
              inicial={{
                segments: profile.segments.map((segment) => segment.id),
                city: profile.city || "",
                uf: profile.uf || "",
              }}
              aoSalvar={() => setEditando(false)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Linha({
  icone: Icone,
  titulo,
  detalhe,
  quando,
  link,
}: {
  icone: typeof ClipboardList;
  titulo: string;
  detalhe: string;
  quando: string;
  link:
    | { to: "/fornecedor/pedidos" }
    | { to: "/fornecedor/orcamentos"; search: { aberto: string } }
    | { to: "/fornecedor/conversas"; search: { aberto: string } };
}) {
  return (
    <li>
      <Link {...link} className="flex items-start gap-3 py-3 transition-colors hover:bg-muted/50">
        <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            {/* Sem truncate: cortava o verbo — "pediu orça..." —, que é o que diz o que fazer. */}
            <p className="font-medium leading-snug">{titulo}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{quandoNaLista(quando)}</span>
          </div>
          {detalhe && <p className="mt-0.5 truncate text-sm text-muted-foreground">{detalhe}</p>}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function EditarCadastro({
  inicial,
  aoSalvar,
}: {
  inicial: { segments: string[]; city: string; uf: string };
  aoSalvar: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: allSegments } = useQuery({
    queryKey: ["segments"],
    queryFn: () => listSegments(),
    staleTime: 60 * 60 * 1000,
  });
  const [segments, setSegments] = useState<string[]>(inicial.segments);
  const [city, setCity] = useState(inicial.city);
  const [uf, setUf] = useState(inicial.uf);

  // Se o cadastro mudar enquanto a folha abre (outra aba salvou), começa dele.
  useEffect(() => {
    setSegments(inicial.segments);
    setCity(inicial.city);
    setUf(inicial.uf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial.segments.join(","), inicial.city, inicial.uf]);

  const save = useMutation({
    mutationFn: () =>
      updateCompanyProfile({
        data: { segments, city: city || undefined, uf: uf || undefined },
      }),
    onSuccess: async () => {
      toast.success("Cadastro atualizado");
      await queryClient.invalidateQueries({ queryKey: ["company-profile"] });
      aoSalvar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (id: string) =>
    setSegments((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 8),
    );

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle>Seu cadastro</DrawerTitle>
        <DrawerDescription>
          É por aqui que os comerciantes do seu nicho te encontram. Até 8 nichos.
        </DrawerDescription>
      </DrawerHeader>
      <div className="space-y-5 overflow-y-auto px-4 pb-6">
        <div className="space-y-2">
          <Label>Nichos que você atende</Label>
          <div className="flex flex-wrap gap-2">
            {(allSegments || []).map((segment) => {
              const selected = segments.includes(segment.id);
              return (
                <button
                  key={segment.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(segment.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {segment.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              className="h-11"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uf">Estado</Label>
            <select
              id="uf"
              value={uf}
              onChange={(event) => setUf(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            >
              <option value="">--</option>
              {UFS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={save.isPending || !segments.length}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Salvando..." : "Salvar cadastro"}
        </Button>
        {!segments.length && (
          <p className="text-center text-xs text-muted-foreground">
            Escolha pelo menos um nicho para salvar.
          </p>
        )}
      </div>
    </>
  );
}
