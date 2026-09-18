import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Download, Package, Plus, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useItemAberto } from "@/hooks/useItemAberto";
import {
  archiveProduct,
  archiveProducts,
  getLimiteDeProdutos,
  listProducts,
  moveStock,
  getVinculoSugerido,
  respostaAoCustoSugerido,
  respostaAoVinculoSugerido,
  saveProduct,
  type Product,
} from "@/lib/api/products.functions";
import { listCategories } from "@/lib/api/supplier.functions";
import { downloadCsv } from "@/lib/csv";
import { rotuloDaOrigem, seloDaOrigem } from "@/lib/custo-automatico";
import { brl, num } from "@/lib/format";
import {
  MARGEM_BAIXA_PERCENTUAL,
  estoqueBaixo,
  margemBaixa,
  margemPercentual,
} from "@/lib/regras-produto";
import { cn } from "@/lib/utils";

type Filtro = "margem" | "estoque";
type Busca = { aberto?: string; filtro?: Filtro };

// O produto aberto e o filtro moram no endereço. O Painel usa isso: tocar em
// "Ração Pedigree está com margem muito baixa" abre a ficha dela, pronta para
// corrigir o preço; tocar no contador "Margem baixa" abre a lista já filtrada.
// E o gesto de voltar do celular fecha a ficha, em vez de sair da tela.
function validarBusca(busca: Record<string, unknown>): Busca {
  // Só as chaves que existem: com { filtro: undefined } o roteador passaria a
  // exigir `search` em todo link para esta tela (ver useItemAberto.ts).
  const resultado: Busca = {};
  if (typeof busca.aberto === "string" && /^[0-9a-f-]{36}$/i.test(busca.aberto))
    resultado.aberto = busca.aberto;
  if (busca.filtro === "margem" || busca.filtro === "estoque") resultado.filtro = busca.filtro;
  return resultado;
}

export const Route = createFileRoute("/_authenticated/produtos")({
  validateSearch: validarBusca,
  head: () => ({ meta: [{ title: "Produtos — Central do Comerciante" }] }),
  component: ProductsPage,
});

const vazio = {
  name: "",
  sku: "",
  categoryId: "",
  costPrice: "",
  salePrice: "",
  stock: "",
  minimumStock: "",
  unit: "un",
};
type Formulario = typeof vazio;
const numero = (valor: string) => Number(valor.replace(",", ".")) || 0;

const formularioDe = (produto: Product): Formulario => ({
  name: produto.name,
  sku: produto.sku || "",
  categoryId: produto.categoryId || "",
  costPrice: String(produto.costPrice),
  salePrice: String(produto.salePrice),
  stock: String(produto.stock),
  minimumStock: String(produto.minimumStock),
  unit: produto.unit,
});

// Produtos no celular.
//
// Antes era uma tabela de sete colunas: no celular ela rolava de lado e o botão
// "Gerenciar" ficava fora da tela, à direita. A margem tinha cor própria —
// vermelho só abaixo de 15% —, diferente da régua do Painel. Agora é uma lista
// de duas linhas por produto, com as mesmas réguas do Painel
// (src/lib/regras-produto.ts), e a ficha abre numa folha de baixo.
function ProductsPage() {
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [termo, setTermo] = useState("");
  const [novo, setNovo] = useState(false);

  const { aberto, abrir, fechar } = useItemAberto(busca.aberto, (id, substituir) =>
    navigate({
      search: (anterior: Busca) => {
        const { aberto: _fechado, ...resto } = anterior;
        return id ? { ...resto, aberto: id } : resto;
      },
      replace: substituir,
    }),
  );

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["products-pdv"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const comMargemBaixa = products.filter((p) => margemBaixa(p.costPrice, p.salePrice));
  const comEstoqueBaixo = products.filter((p) => estoqueBaixo(p.stock, p.minimumStock));
  const base =
    busca.filtro === "margem"
      ? comMargemBaixa
      : busca.filtro === "estoque"
        ? comEstoqueBaixo
        : products;
  const t = termo.toLowerCase().trim();
  const lista = base.filter(
    (p) => !t || p.name.toLowerCase().includes(t) || (p.sku || "").toLowerCase().includes(t),
  );
  const produtoAberto = products.find((p) => p.id === aberto) || null;

  const trocarFiltro = (filtro: Filtro | undefined) =>
    navigate({
      search: (anterior: Busca) => {
        const { filtro: _antigo, aberto: _aberto, ...resto } = anterior;
        return filtro ? { ...resto, filtro } : resto;
      },
      replace: true,
    });

  const chips: { rotulo: string; valor: Filtro | undefined; quantos: number }[] = [
    { rotulo: "Todos", valor: undefined, quantos: products.length },
    { rotulo: "Margem baixa", valor: "margem", quantos: comMargemBaixa.length },
    { rotulo: "Abaixo do mínimo", valor: "estoque", quantos: comEstoqueBaixo.length },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-3xl">Produtos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Preços, margem e estoque</p>
        </div>
        <Button className="shrink-0" onClick={() => setNovo(true)}>
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar produto"
            className="h-11 pl-9"
            placeholder="Buscar por nome ou código"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const ativo = busca.filtro === chip.valor;
            return (
              <button
                key={chip.rotulo}
                type="button"
                onClick={() => trocarFiltro(chip.valor)}
                aria-pressed={ativo}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {chip.rotulo} <span className="tabular-nums opacity-80">{chip.quantos}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_item, indice) => (
            <div key={indice} className="h-14 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : !products.length ? (
        <Card className="p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-medium">Nenhum produto cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre o que você vende com custo e preço para a Central calcular sua margem.
          </p>
        </Card>
      ) : !lista.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {busca.filtro === "margem"
            ? "Nenhum produto com margem baixa."
            : busca.filtro === "estoque"
              ? "Nenhum produto abaixo do mínimo."
              : "Nenhum produto com esse nome."}
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {lista.map((p) => {
            const margem = margemPercentual(p.costPrice, p.salePrice);
            const baixa = margemBaixa(p.costPrice, p.salePrice);
            const acabando = estoqueBaixo(p.stock, p.minimumStock);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => abrir(p.id)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {brl(p.salePrice)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      <span className={cn(acabando && "font-semibold text-warning")}>
                        {num(p.stock)} {p.unit}
                        {acabando ? " · abaixo do mínimo" : ""}
                      </span>
                      {" · "}
                      <span className={cn(baixa && "font-semibold text-destructive")}>
                        {margem === null ? "sem preço de venda" : `margem ${num(margem, 1)}%`}
                      </span>
                      {p.costPrice > 0 && p.costSource !== "digitado" && (
                        <span> · custo {seloDaOrigem[p.costSource]}</span>
                      )}
                      {p.costSuggested !== null && (
                        <span className="font-semibold text-primary">
                          {" · "}custo novo sugerido
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {products.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            downloadCsv(
              `produtos-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Produto", "SKU", "Custo", "Venda", "Estoque", "Mínimo", "Unidade"],
              lista.map((p) => [
                p.name,
                p.sku,
                p.costPrice,
                p.salePrice,
                p.stock,
                p.minimumStock,
                p.unit,
              ]),
            )
          }
        >
          <Download className="mr-1 h-4 w-4" /> Exportar planilha
        </Button>
      )}

      <Drawer open={novo} onOpenChange={(estado) => !estado && setNovo(false)}>
        <DrawerContent className="max-h-[92vh]">
          {novo && (
            <NovoProduto
              aoSalvar={async () => {
                setNovo(false);
                await refresh();
              }}
            />
          )}
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(produtoAberto)} onOpenChange={(estado) => !estado && fechar()}>
        <DrawerContent className="max-h-[92vh]">
          {produtoAberto && (
            <FichaDoProduto
              key={produtoAberto.id}
              produto={produtoAberto}
              aoMudar={refresh}
              aoArquivar={async () => {
                fechar();
                await refresh();
              }}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function NovoProduto({ aoSalvar }: { aoSalvar: () => Promise<void> }) {
  const limite = useQuery({
    queryKey: ["limite-de-produtos"],
    queryFn: () => getLimiteDeProdutos(),
  });
  if (limite.data?.cheio) return <LimiteCheio limite={limite.data} />;
  return <FormularioNovo aoSalvar={aoSalvar} />;
}

type EstadoLimite = Awaited<ReturnType<typeof getLimiteDeProdutos>>;

// X01: o plano encheu. O primeiro caminho é de graça (arquivar o que não vende
// há 90 dias); o upgrade vem depois, e só se ainda houver plano acima.
function LimiteCheio({ limite }: { limite: EstadoLimite }) {
  const queryClient = useQueryClient();
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(limite.parados.map((p) => p.id)),
  );
  const [verTodos, setVerTodos] = useState(false);
  const visiveis = verTodos ? limite.parados : limite.parados.slice(0, 3);
  const arquivar = useMutation({
    mutationFn: () => archiveProducts({ data: { ids: [...marcados] } }),
    onSuccess: async ({ arquivados }) => {
      toast.success(`${arquivados} arquivados. O histórico de vendas foi mantido.`);
      await queryClient.invalidateQueries({ queryKey: ["limite-de-produtos"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const nomeDoPlano = limite.plano.charAt(0).toUpperCase() + limite.plano.slice(1);

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle>Novo produto</DrawerTitle>
      </DrawerHeader>
      <div className="space-y-4 overflow-y-auto px-4 pb-6">
        <Card className="border-warning/50 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 text-warning">
              <TriangleAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Você chegou nos {limite.limite} produtos</p>
              <p className="text-sm text-muted-foreground">limite do plano {nomeDoPlano}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full bg-warning" />
          </div>
          <p className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {limite.ativos} de {limite.limite}
            </span>
            <span>0 vagas</span>
          </p>
        </Card>

        {limite.parados.length > 0 && (
          <section>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sem pagar nada
            </p>
            <p className="mt-1 text-sm">
              {limite.parados.length === 1
                ? "Este não vende há mais de 90 dias."
                : `Estes ${limite.parados.length} não vendem há mais de 90 dias.`}{" "}
              Arquivar libera vaga e eles voltam quando você quiser.
            </p>
            <Card className="mt-3 divide-y">
              {visiveis.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--primary)]"
                    checked={marcados.has(p.id)}
                    onChange={(e) =>
                      setMarcados((atual) => {
                        const novo = new Set(atual);
                        if (e.target.checked) novo.add(p.id);
                        else novo.delete(p.id);
                        return novo;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      sem venda há {p.diasParado} dias
                    </span>
                  </span>
                </label>
              ))}
              {!verTodos && limite.parados.length > 3 && (
                <button
                  type="button"
                  className="w-full p-3 text-center text-sm font-semibold text-primary"
                  onClick={() => setVerTodos(true)}
                >
                  Ver os {limite.parados.length}
                </button>
              )}
            </Card>
            <Button
              size="lg"
              className="mt-3 w-full"
              disabled={arquivar.isPending || marcados.size === 0}
              onClick={() => arquivar.mutate()}
            >
              {arquivar.isPending ? "Arquivando..." : `Arquivar ${marcados.size} e continuar`}
            </Button>
          </section>
        )}

        {limite.parados.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum produto seu está parado há mais de 90 dias, então não há o que arquivar sem
            perder venda. Você ainda pode arquivar um a um na lista de produtos.
          </p>
        )}

        {limite.proximo && (
          <>
            {limite.parados.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">ou</p>
            )}
            <Card className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {limite.proximo.plano.charAt(0).toUpperCase() + limite.proximo.plano.slice(1)} ·{" "}
                    {limite.proximo.produtos === null
                      ? "produtos ilimitados"
                      : `até ${limite.proximo.produtos} produtos`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    + {limite.proximo.perguntasIA} perguntas à IA · {limite.proximo.usuarios}{" "}
                    usuários
                  </p>
                </div>
                <p className="font-bold whitespace-nowrap tabular-nums">
                  {brl(limite.proximo.preco)}
                </p>
              </div>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/assinatura">Ver plano</Link>
              </Button>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function FormularioNovo({ aoSalvar }: { aoSalvar: () => Promise<void> }) {
  const [form, setForm] = useState<Formulario>(vazio);
  const criar = useMutation({
    mutationFn: () =>
      saveProduct({
        data: {
          name: form.name,
          sku: form.sku,
          costPrice: numero(form.costPrice),
          salePrice: numero(form.salePrice),
          stock: numero(form.stock),
          minimumStock: numero(form.minimumStock),
          unit: form.unit || "un",
          categoryId: form.categoryId || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Produto cadastrado");
      await aoSalvar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle>Novo produto</DrawerTitle>
      </DrawerHeader>
      <div className="overflow-y-auto px-4 pb-4">
        <CamposDoProduto form={form} setForm={setForm} comEstoqueInicial />
        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={criar.isPending || !form.name.trim()}
          onClick={() => criar.mutate()}
        >
          {criar.isPending ? "Salvando..." : "Cadastrar produto"}
        </Button>
      </div>
    </>
  );
}

function FichaDoProduto({
  produto,
  aoMudar,
  aoArquivar,
}: {
  produto: Product;
  aoMudar: () => Promise<void>;
  aoArquivar: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Formulario>(() => formularioDe(produto));
  const [modo, setModo] = useState<"entry" | "adjustment">("entry");
  const [quantidade, setQuantidade] = useState("");
  const [confirmandoArquivo, setConfirmandoArquivo] = useState(false);

  // Uma venda feita em outra tela muda o estoque deste produto: o saldo
  // mostrado acompanha, sem desfazer o que a pessoa está digitando no preço.
  useEffect(() => {
    setForm((atual) => ({ ...atual, stock: String(produto.stock) }));
  }, [produto.stock]);

  // O custo pode mudar por fora (a pessoa aceitou a sugestão, ou uma compra
  // foi concluída): o campo acompanha, sem apagar o resto do que está digitado.
  useEffect(() => {
    setForm((atual) => ({ ...atual, costPrice: String(produto.costPrice) }));
  }, [produto.costPrice]);

  const responderCusto = useMutation({
    mutationFn: (aceitar: boolean) =>
      respostaAoCustoSugerido({ data: { id: produto.id, aceitar } }),
    onSuccess: async (_, aceitar) => {
      toast.success(aceitar ? "Custo atualizado" : "Mantivemos o seu custo");
      await aoMudar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { data: vinculo } = useQuery({
    queryKey: ["vinculo-sugerido", produto.id],
    queryFn: () => getVinculoSugerido({ data: { id: produto.id } }),
  });
  const responderVinculo = useMutation({
    mutationFn: (aceitar: boolean) =>
      respostaAoVinculoSugerido({
        data: { id: produto.id, catalogItemId: vinculo!.catalogItemId, aceitar },
      }),
    onSuccess: async (_, aceitar) => {
      toast.success(aceitar ? "Produto ligado ao catálogo" : "Ok, não vamos sugerir de novo");
      await queryClient.invalidateQueries({ queryKey: ["vinculo-sugerido", produto.id] });
      await aoMudar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mudouPreco =
    form.name !== produto.name ||
    form.sku !== (produto.sku || "") ||
    form.categoryId !== (produto.categoryId || "") ||
    numero(form.costPrice) !== produto.costPrice ||
    numero(form.salePrice) !== produto.salePrice ||
    numero(form.minimumStock) !== produto.minimumStock ||
    form.unit !== produto.unit;

  const salvar = useMutation({
    mutationFn: () =>
      saveProduct({
        data: {
          id: produto.id,
          name: form.name,
          sku: form.sku,
          costPrice: numero(form.costPrice),
          salePrice: numero(form.salePrice),
          stock: produto.stock,
          minimumStock: numero(form.minimumStock),
          unit: form.unit || "un",
          categoryId: form.categoryId || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Produto atualizado");
      await aoMudar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const movimentar = useMutation({
    mutationFn: () =>
      moveStock({ data: { productId: produto.id, mode: modo, quantity: numero(quantidade) } }),
    onSuccess: async () => {
      setQuantidade("");
      toast.success("Estoque atualizado");
      await aoMudar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const arquivar = useMutation({
    mutationFn: () => archiveProduct({ data: { id: produto.id } }),
    onSuccess: async () => {
      toast.success("Produto arquivado. O histórico de vendas foi mantido.");
      await aoArquivar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="leading-snug">{produto.name}</DrawerTitle>
        <DrawerDescription className="tabular-nums">
          {num(produto.stock)} {produto.unit} em estoque
          {estoqueBaixo(produto.stock, produto.minimumStock) ? " · abaixo do mínimo" : ""}
        </DrawerDescription>
      </DrawerHeader>

      <div className="space-y-6 overflow-y-auto px-4 pb-6">
        <section>
          <CamposDoProduto form={form} setForm={setForm} />
          {produto.costPrice > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {rotuloDaOrigem[produto.costSource]}.
              {produto.costSource === "estimado" &&
                " Vira o preço real assim que você concluir uma compra deste item pela Central."}
            </p>
          )}
          {vinculo && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium">
                Este produto é o mesmo que <span className="font-semibold">{vinculo.nome}</span> do
                catálogo dos fornecedores?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Se for, a Central passa a acompanhar o custo dele sozinha.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  disabled={responderVinculo.isPending}
                  onClick={() => responderVinculo.mutate(true)}
                >
                  Sim, é o mesmo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={responderVinculo.isPending}
                  onClick={() => responderVinculo.mutate(false)}
                >
                  Não é
                </Button>
              </div>
            </div>
          )}
          {produto.costSuggested !== null && produto.costSuggestedSource && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium">
                {produto.costSuggestedSource === "real"
                  ? "Você pagou"
                  : "A tabela dos fornecedores indica"}{" "}
                <span className="tabular-nums">
                  {brl(produto.costSuggested)} por {produto.unit}
                </span>
                , e o seu custo é <span className="tabular-nums">{brl(produto.costPrice)}</span>.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  disabled={responderCusto.isPending}
                  onClick={() => responderCusto.mutate(true)}
                >
                  Usar {brl(produto.costSuggested)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={responderCusto.isPending}
                  onClick={() => responderCusto.mutate(false)}
                >
                  Manter o meu
                </Button>
              </div>
            </div>
          )}
          <Button
            size="lg"
            className="mt-3 w-full"
            disabled={salvar.isPending || !form.name.trim() || !mudouPreco}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </section>

        <section className="space-y-3 border-t border-border pt-5">
          <h3 className="font-semibold">Estoque</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={modo === "entry" ? "default" : "outline"}
              onClick={() => setModo("entry")}
            >
              Chegou mercadoria
            </Button>
            <Button
              variant={modo === "adjustment" ? "default" : "outline"}
              onClick={() => setModo("adjustment")}
            >
              Contei o estoque
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quantidade">
              {modo === "entry" ? "Quantas chegaram" : "Quantas tem na prateleira agora"}
            </Label>
            <Input
              id="quantidade"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              className="h-11 tabular-nums"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            {quantidade !== "" && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Estoque passa de {num(produto.stock)} para{" "}
                {num(modo === "entry" ? produto.stock + numero(quantidade) : numero(quantidade))}{" "}
                {produto.unit}.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={movimentar.isPending || quantidade === ""}
            onClick={() => movimentar.mutate()}
          >
            Atualizar estoque
          </Button>
        </section>

        <section className="border-t border-border pt-5">
          {confirmandoArquivo ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                O produto sai da lista e do registro de venda. As vendas antigas continuam no
                histórico.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                disabled={arquivar.isPending}
                onClick={() => arquivar.mutate()}
              >
                Sim, arquivar produto
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setConfirmandoArquivo(false)}
              >
                Voltar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setConfirmandoArquivo(true)}
            >
              Arquivar produto
            </Button>
          )}
        </section>
      </div>
    </>
  );
}

function CamposDoProduto({
  form,
  setForm,
  comEstoqueInicial = false,
}: {
  form: Formulario;
  setForm: (valor: Formulario) => void;
  comEstoqueInicial?: boolean;
}) {
  const { data: categorias } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
    staleTime: 60 * 60 * 1000,
  });
  const campo = "h-11";
  const margemAgora = margemPercentual(numero(form.costPrice), numero(form.salePrice));
  const baixaAgora = margemBaixa(numero(form.costPrice), numero(form.salePrice));
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Campo rotulo="Nome" id="nome">
          <Input
            id="nome"
            className={campo}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Campo>
      </div>
      <Campo rotulo="Custo (R$)" id="custo">
        <Input
          id="custo"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className={cn(campo, "tabular-nums")}
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
        />
      </Campo>
      <Campo rotulo="Venda (R$)" id="venda">
        <Input
          id="venda"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className={cn(campo, "tabular-nums")}
          value={form.salePrice}
          onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
        />
      </Campo>
      {/* A conta da margem, logo abaixo dos preços e mudando enquanto se digita:
          é para isso que a pessoa abriu a ficha a partir do aviso do Painel. */}
      <p
        className={cn(
          "col-span-2 -mt-1 text-sm tabular-nums",
          baixaAgora ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        {margemAgora === null
          ? "Informe o preço de venda para calcular a margem."
          : `Sobra ${brl(numero(form.salePrice) - numero(form.costPrice))} por ${form.unit || "un"} — margem de ${num(margemAgora, 1)}%${baixaAgora ? `, abaixo de ${MARGEM_BAIXA_PERCENTUAL}%` : ""}.`}
      </p>
      {comEstoqueInicial && (
        <Campo rotulo="Estoque inicial" id="estoque">
          <Input
            id="estoque"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            className={cn(campo, "tabular-nums")}
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
        </Campo>
      )}
      <div className={comEstoqueInicial ? "" : "col-span-2"}>
        <Campo rotulo="Avisar quando tiver" id="minimo">
          <Input
            id="minimo"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            placeholder="5"
            className={cn(campo, "tabular-nums")}
            value={form.minimumStock}
            onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
          />
        </Campo>
      </div>
      <Campo rotulo="Unidade" id="unidade">
        <Input
          id="unidade"
          className={campo}
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
      </Campo>
      <Campo rotulo="Código (opcional)" id="sku">
        <Input
          id="sku"
          className={campo}
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
      </Campo>
      <div className="col-span-2">
        <Campo rotulo="Categoria" id="categoria">
          <select
            id="categoria"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
          >
            <option value="">Sem categoria</option>
            {(categorias || []).map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.name}
              </option>
            ))}
          </select>
        </Campo>
      </div>
    </div>
  );
}

function Campo({
  rotulo,
  id,
  children,
}: {
  rotulo: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
    </div>
  );
}
