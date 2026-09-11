import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Columns3, List, Mail, MessageCircle, Phone, Search, Store, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getProspectResumo,
  listProspectCidades,
  listProspectQuadro,
  listProspects,
  salvarProspect,
} from "@/lib/api/prospeccao.functions";
import { dataBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/adm/prospeccao")({
  head: () => ({ meta: [{ title: "Prospecção — Back office" }] }),
  component: AdminProspeccao,
});

type Lado = "comerciante" | "fornecedor";

// O formato do cartão vem do próprio servidor: se um campo mudar lá, o
// TypeScript acusa aqui, em vez de a tela mostrar "undefined" para a Julia.
type ItemProspect = Awaited<ReturnType<typeof listProspects>>["itens"][number];

const ETAPAS = [
  { id: "a contatar", nome: "A contatar" },
  { id: "contatado", nome: "Contatado" },
  { id: "respondeu", nome: "Respondeu" },
  { id: "cadastrou", nome: "Cadastrou" },
  { id: "vitrine no ar", nome: "Vitrine no ar" },
  { id: "sem interesse", nome: "Sem interesse" },
] as const;

// O texto que abre a conversa, por lado.
//
// Com fornecedor a conversa convida para a vitrine gratuita. Com pet shop ela
// PERGUNTA de quem ele compra — a resposta é o que diz quais distribuidores
// realmente entregam naquela cidade, e é o que abre a porta com eles depois.
const MENSAGEM: Record<Lado, (nome: string, cidade: string) => string> = {
  fornecedor: (nome, cidade) =>
    `Oi! Aqui é a Julia, da Central do Comerciante.\n\n` +
    `Estou montando uma vitrine online de fornecedores de pet shop e queria a ${nome} nela. ` +
    `É gratuito para o fornecedor: você publica seu catálogo e os pet shops de ${cidade || "sua região"} ` +
    `e região encontram vocês na hora de comprar.\n\n` +
    `Posso te mandar o link para dar uma olhada?`,
  comerciante: (nome, cidade) =>
    `Oi! Aqui é a Julia, da Central do Comerciante.\n\n` +
    `Estou montando uma ferramenta para pet shop comparar preço de fornecedor, e queria te fazer ` +
    `duas perguntas rápidas sobre a ${nome}${cidade ? `, de ${cidade}` : ""}: de quem vocês compram ração hoje? ` +
    `E os acessórios, coleira, caminha?\n\n` +
    `É rápido, e quando ficar pronto eu te aviso primeiro.`,
};

/**
 * Um cartão que o quadro arrasta.
 *
 * O arrastar usa o recurso do próprio navegador, sem biblioteca. Ele não
 * funciona em tela de toque — e por isso o seletor de etapa continua em cada
 * cartão, na lista e no quadro. Arrastar é o atalho de quem está no
 * computador; o seletor é o que funciona em qualquer lugar. Trocar um pelo
 * outro deixaria a tela inutilizável no celular, que é de onde se liga.
 */
function CartaoDoQuadro({
  item,
  lado,
  aoMudar,
  arrastando,
  setArrastando,
}: {
  item: ItemProspect;
  lado: Lado;
  aoMudar: (id: string, status: string) => void;
  arrastando: string | null;
  setArrastando: (id: string | null) => void;
}) {
  return (
    <Card
      draggable
      onDragStart={(e) => {
        setArrastando(item.id);
        e.dataTransfer.effectAllowed = "move";
        // Alguns navegadores só iniciam o arrasto se houver dado anexado.
        e.dataTransfer.setData("text/plain", item.id);
      }}
      onDragEnd={() => setArrastando(null)}
      className={cn(
        "cursor-grab space-y-1.5 p-3 active:cursor-grabbing",
        arrastando === item.id && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{item.nome}</span>
        {item.virouCliente && (
          <Badge className="bg-success/15 text-success shrink-0 text-[10px]">cliente</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {[item.cidade, item.uf].filter(Boolean).join(" - ")}
        {item.fornece ? ` · ${item.fornece}` : ""}
      </p>
      {item.compraDeQuem && (
        <p className="text-xs text-muted-foreground">compra de: {item.compraDeQuem}</p>
      )}
      <div className="flex items-center gap-2 pt-0.5">
        {item.whatsapp && (
          <a
            href={`https://wa.me/55${item.whatsapp}?text=${encodeURIComponent(
              MENSAGEM[lado](item.nome, item.cidade),
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={() => {
              if (item.status === "a contatar") aoMudar(item.id, "contatado");
            }}
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </a>
        )}
        {item.telefone && (
          <a
            href={`tel:${item.telefone.replace(/\D/g, "")}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <Phone className="h-3 w-3" />
            {item.telefone}
          </a>
        )}
      </div>
      <select
        className="mt-1 h-7 w-full rounded-md border border-input bg-background px-1.5 text-[11px]"
        value={item.status}
        onChange={(e) => aoMudar(item.id, e.target.value)}
      >
        {ETAPAS.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
    </Card>
  );
}

function AdminProspeccao() {
  const queryClient = useQueryClient();
  const [lado, setLado] = useState<Lado>("fornecedor");
  const [modo, setModo] = useState<"lista" | "quadro">("lista");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [status, setStatus] = useState("");
  const [quemDecide, setQuemDecide] = useState(true);
  const [comWhatsapp, setComWhatsapp] = useState(false);
  const [comEmail, setComEmail] = useState(false);
  const [soPrincipal, setSoPrincipal] = useState(false);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  // Trocar de lado ou de estado zera o que ficou preso do anterior: a cidade
  // de São Paulo não existe no Acre, e a página 7 quase nunca existe no filtro
  // novo — cair numa lista vazia parece defeito.
  useEffect(() => {
    setCidade("");
    setPagina(1);
  }, [lado, uf]);
  useEffect(() => setPagina(1), [status, quemDecide, comWhatsapp, comEmail, soPrincipal, busca]);

  const resumo = useQuery({
    queryKey: ["prospect-resumo", lado],
    queryFn: () => getProspectResumo({ data: { lado, nicho: "pet" } }),
  });

  const cidades = useQuery({
    queryKey: ["prospect-cidades", lado, uf],
    queryFn: () => listProspectCidades({ data: { lado, nicho: "pet", uf } }),
    enabled: uf.length === 2,
  });

  const lista = useQuery({
    queryKey: [
      "prospects",
      lado,
      uf,
      cidade,
      status,
      quemDecide,
      comWhatsapp,
      comEmail,
      soPrincipal,
      busca,
      pagina,
    ],
    queryFn: () =>
      listProspects({
        data: {
          lado,
          nicho: "pet",
          uf: uf || undefined,
          cidade: cidade || undefined,
          status: (status || undefined) as never,
          quemDecide: quemDecide || undefined,
          comWhatsapp: comWhatsapp || undefined,
          comEmail: comEmail || undefined,
          soPrincipal: soPrincipal || undefined,
          soAtivas: true,
          busca: busca || undefined,
          pagina,
        },
      }),
  });

  // O quadro só busca quando está aberto. Sem isto, seis consultas sairiam
  // toda vez que alguém mexe num filtro na tela de lista, para desenhar algo
  // que ninguém está olhando.
  const quadro = useQuery({
    queryKey: [
      "prospect-quadro",
      lado,
      uf,
      cidade,
      quemDecide,
      comWhatsapp,
      comEmail,
      soPrincipal,
      busca,
    ],
    enabled: modo === "quadro",
    queryFn: () =>
      listProspectQuadro({
        data: {
          lado,
          nicho: "pet",
          uf: uf || undefined,
          cidade: cidade || undefined,
          quemDecide: quemDecide || undefined,
          comWhatsapp: comWhatsapp || undefined,
          comEmail: comEmail || undefined,
          soPrincipal: soPrincipal || undefined,
          soAtivas: true,
          busca: busca || undefined,
          pagina: 1,
        },
      }),
  });

  const salvar = useMutation({
    mutationFn: (entrada: {
      id: string;
      status?: string;
      compraDeQuem?: string;
      observacoes?: string;
    }) => salvarProspect({ data: entrada as never }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prospects"] }),
        queryClient.invalidateQueries({ queryKey: ["prospect-quadro"] }),
        queryClient.invalidateQueries({ queryKey: ["prospect-resumo"] }),
      ]);
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const n = (v: number) => v.toLocaleString("pt-BR");
  const dados = resumo.data;
  const itens = lista.data?.itens ?? [];
  const total = lista.data?.total ?? 0;
  const paginas = Math.ceil(total / (lista.data?.porPagina ?? 50));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Prospecção</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Empresas do nicho pet tiradas dos Dados Abertos do CNPJ. Não são clientes da Central — é a
          lista de quem ainda vamos procurar.
        </p>
      </div>

      {/* De que lado do balcão. É o primeiro corte, e muda tudo o que vem
          abaixo: os números, os filtros e o texto da mensagem. */}
      <div className="grid max-w-lg grid-cols-2 gap-2">
        {(["fornecedor", "comerciante"] as const).map((tipo) => {
          const Icone = tipo === "fornecedor" ? Truck : Store;
          const ativo = lado === tipo;
          return (
            <button
              key={tipo}
              type="button"
              aria-pressed={ativo}
              onClick={() => setLado(tipo)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                ativo
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
            >
              <Icone className="h-4 w-4" />
              {tipo === "fornecedor" ? "Quem fornece" : "Quem compra"}
            </button>
          );
        })}
      </div>

      {dados && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { rotulo: "na lista", valor: n(dados.total) },
            { rotulo: "com WhatsApp", valor: n(dados.comWhatsapp) },
            { rotulo: "ainda não contatados", valor: n(dados.aContatar), destaque: true },
            { rotulo: "já viraram cliente", valor: n(dados.cadastraram) },
          ].map((cartao) => (
            <Card
              key={cartao.rotulo}
              className={cn("p-4", cartao.destaque && "border-primary/40 bg-primary/5")}
            >
              <p className={cn("text-2xl font-bold", cartao.destaque && "text-primary")}>
                {cartao.valor}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{cartao.rotulo}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Estado</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
            >
              <option value="">Brasil inteiro</option>
              {dados?.estados.map((e) => (
                <option key={e.uf} value={e.uf}>
                  {e.uf} ({n(e.total)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Cidade</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              disabled={!uf}
            >
              <option value="">{uf ? "Todas" : "Escolha o estado"}</option>
              {cidades.data?.map((c) => (
                <option key={c.cidade} value={c.cidade}>
                  {c.cidade} ({n(c.total)})
                </option>
              ))}
            </select>
          </label>
          {/* No quadro este filtro não aparece: lá a coluna já é a etapa, e
              filtrar por uma delas deixaria as outras cinco vazias. */}
          {modo === "lista" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Situação do contato</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Qualquer</option>
                {ETAPAS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Buscar</span>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome ou CNPJ"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-sm">
          {[
            { valor: quemDecide, set: setQuemDecide, rotulo: "Só quem decide (sem filial)" },
            { valor: comWhatsapp, set: setComWhatsapp, rotulo: "Tem WhatsApp" },
            { valor: comEmail, set: setComEmail, rotulo: "Tem e-mail" },
            { valor: soPrincipal, set: setSoPrincipal, rotulo: "Só atividade principal" },
          ].map((op) => (
            <label key={op.rotulo} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={op.valor}
                onChange={(e) => op.set(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              {op.rotulo}
            </label>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {modo === "lista" && (
              <span className="text-muted-foreground">
                <strong className="text-foreground">{n(total)}</strong> encontradas
              </span>
            )}
            <div className="flex rounded-md border border-border p-0.5">
              {(["lista", "quadro"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={modo === m}
                  onClick={() => setModo(m)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    modo === m
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "lista" ? (
                    <List className="h-3.5 w-3.5" />
                  ) : (
                    <Columns3 className="h-3.5 w-3.5" />
                  )}
                  {m === "lista" ? "Lista" : "Quadro"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {modo === "quadro" ? (
        quadro.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando o quadro...</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {quadro.data?.colunas.map((coluna) => {
              const etapa = ETAPAS.find((e) => e.id === coluna.etapa);
              const alvo = colunaAlvo === coluna.etapa;
              return (
                <div
                  key={coluna.etapa}
                  onDragOver={(e) => {
                    // Sem o preventDefault o navegador recusa a soltura e o
                    // cartão volta para o lugar, sem explicação nenhuma.
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (colunaAlvo !== coluna.etapa) setColunaAlvo(coluna.etapa);
                  }}
                  onDragLeave={() => setColunaAlvo((c) => (c === coluna.etapa ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = arrastando ?? e.dataTransfer.getData("text/plain");
                    setColunaAlvo(null);
                    setArrastando(null);
                    if (id) salvar.mutate({ id, status: coluna.etapa });
                  }}
                  className={cn(
                    "flex w-64 shrink-0 flex-col rounded-lg border p-2 transition-colors",
                    alvo ? "border-primary bg-primary/5" : "border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-baseline justify-between px-1 pb-2">
                    <span className="text-sm font-semibold">{etapa?.nome ?? coluna.etapa}</span>
                    <span className="text-xs text-muted-foreground">{n(coluna.total)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {coluna.itens.map((item) => (
                      <CartaoDoQuadro
                        key={item.id}
                        item={item}
                        lado={lado}
                        arrastando={arrastando}
                        setArrastando={setArrastando}
                        aoMudar={(id, novoStatus) => salvar.mutate({ id, status: novoStatus })}
                      />
                    ))}
                    {!coluna.itens.length && (
                      <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                        {alvo ? "Solte aqui" : "vazia"}
                      </p>
                    )}
                    {/* Quem vê trinta de cento e dezessete mil precisa saber
                        que está vendo trinta, senão acha que o resto sumiu. */}
                    {coluna.total > coluna.mostrando && (
                      <p className="px-1 pt-1 text-center text-[11px] text-muted-foreground">
                        mostrando {coluna.mostrando} de {n(coluna.total)} — use a lista para ver o
                        resto
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : lista.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : !itens.length ? (
        <Card className="p-8 text-center">
          <p className="font-medium">Nenhuma empresa com esses filtros.</p>
          <p className="mt-1 text-sm text-muted-foreground">Afrouxe um filtro e tente de novo.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {itens.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.nome}</span>
                    {item.confere === "principal" && (
                      <Badge variant="secondary" className="text-[11px]">
                        atividade principal
                      </Badge>
                    )}
                    {item.virouCliente && (
                      <Badge className="bg-success/15 text-success text-[11px]">é cliente</Badge>
                    )}
                    {/* Ligar para uma central que atende 365 lojas é ligar uma
                        vez, não 365. O aviso evita a ligação repetida. */}
                    {item.contatosIguais >= 10 && (
                      <Badge variant="outline" className="text-[11px]">
                        central de {item.contatosIguais} empresas
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[item.cidade, item.uf].filter(Boolean).join(" - ")}
                    {item.fornece ? ` · ${item.fornece}` : ""}
                    {item.enderecos > 1 ? ` · ${item.matrizOuFilial} de ${item.enderecos}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {item.telefone && (
                      <a
                        href={`tel:${item.telefone.replace(/\D/g, "")}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {item.telefone}
                      </a>
                    )}
                    {item.email && (
                      <a
                        href={`mailto:${item.email}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {item.email}
                      </a>
                    )}
                  </div>
                  {item.contatadoEm && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      contatado em {dataBR(item.contatadoEm)}
                      {item.responsavel ? ` por ${item.responsavel}` : ""}
                      {item.compraDeQuem ? ` · compra de: ${item.compraDeQuem}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {item.whatsapp && (
                    <Button asChild size="sm">
                      <a
                        href={`https://wa.me/55${item.whatsapp}?text=${encodeURIComponent(
                          MENSAGEM[lado](item.nome, item.cidade),
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          // Abrir a conversa já marca como contatado: o gesto
                          // de falar e o de anotar viram um só, e ninguém
                          // esquece de anotar depois.
                          if (item.status === "a contatar")
                            salvar.mutate({ id: item.id, status: "contatado" });
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={item.status}
                    disabled={salvar.isPending}
                    onChange={(e) => salvar.mutate({ id: item.id, status: e.target.value })}
                  >
                    {ETAPAS.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* A pergunta que mais rende com pet shop: de quem ele compra.
                  Fica na linha, sem abrir tela nova, porque é anotada durante
                  a ligação — e o que exige clique a mais não é anotado. */}
              {lado === "comerciante" && item.status !== "a contatar" && (
                <Input
                  className="mt-3 h-8 text-sm"
                  placeholder="De quem esse pet shop compra? (anote aqui)"
                  defaultValue={item.compraDeQuem}
                  onBlur={(e) => {
                    if (e.target.value !== item.compraDeQuem)
                      salvar.mutate({ id: item.id, compraDeQuem: e.target.value });
                  }}
                />
              )}
            </Card>
          ))}

          {paginas > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {pagina} de {n(paginas)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= paginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
