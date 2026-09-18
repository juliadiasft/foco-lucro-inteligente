import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
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
import {
  efeitoDosFiltros,
  getFiltrosDeOrcamento,
  salvarFiltrosDeOrcamento,
} from "@/lib/api/supplier-filtros.functions";
import { listSegments } from "@/lib/api/segments.functions";
import { filtroAtivo, SEM_FILTRO, type FiltrosDeOrcamento } from "@/lib/filtro-orcamentos";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

const VALORES = [null, 500, 1000, 2000] as const;
const ALCANCES = [
  { id: "todos", rotulo: "Qualquer lugar" },
  { id: "uf", rotulo: "Só do meu estado" },
  { id: "cidade", rotulo: "Só da minha cidade" },
] as const;

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

// S06: o fornecedor escolhe de que pedidos quer ser avisado — e vê, antes de
// salvar, o que isso faz com a taxa de resposta e com a posição dele. O filtro
// esconde o pedido da lista e do aviso; não o tira da conta da taxa.
export function FiltroDeOrcamentos({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const queryClient = useQueryClient();
  const salvos = useQuery({
    queryKey: ["filtros-de-orcamento"],
    queryFn: () => getFiltrosDeOrcamento(),
  });
  const segmentos = useQuery({
    queryKey: ["segments"],
    queryFn: () => listSegments(),
    staleTime: 60 * 60 * 1000,
  });
  const [rascunho, setRascunho] = useState<FiltrosDeOrcamento>(SEM_FILTRO);

  // Cada vez que abre, parte do que está salvo.
  useEffect(() => {
    if (aberto && salvos.data) setRascunho(salvos.data);
  }, [aberto, salvos.data]);

  const efeito = useQuery({
    queryKey: ["efeito-dos-filtros", rascunho],
    queryFn: () => efeitoDosFiltros({ data: rascunho }),
    enabled: aberto,
  });

  const salvar = useMutation({
    mutationFn: () => salvarFiltrosDeOrcamento({ data: rascunho }),
    onSuccess: async () => {
      toast.success("Filtros salvos");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["filtros-de-orcamento"] }),
        queryClient.invalidateQueries({ queryKey: ["quotes"] }),
        queryClient.invalidateQueries({ queryKey: ["posicao-na-busca"] }),
      ]);
      fechar();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const e = efeito.data;
  const mudouATaxa = e && e.escondidos > 0 && e.taxaAtual !== e.taxaComFiltro;

  return (
    <Drawer open={aberto} onOpenChange={(estado) => !estado && fechar()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Filtrar orçamentos</DrawerTitle>
          <DrawerDescription>
            Escolha de que pedidos quer ser avisado. Os outros ficam escondidos, e você pode
            mostrá-los quando quiser.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-6">
          <section>
            <p className="font-semibold">Valor estimado</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {VALORES.map((v) => (
                <button
                  key={v ?? "todos"}
                  type="button"
                  onClick={() => setRascunho({ ...rascunho, valorMinimo: v })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium",
                    rascunho.valorMinimo === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {v === null ? "Qualquer valor" : `Acima de ${brl(v)}`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pedido sem preço no seu catálogo não tem valor estimado e nunca é escondido.
            </p>
          </section>

          <section>
            <p className="font-semibold">De onde</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALCANCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setRascunho({ ...rascunho, alcance: a.id })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium",
                    rascunho.alcance === a.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="font-semibold">Nicho do comerciante</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(segmentos.data ?? []).map((s) => {
                const marcado = rascunho.segmentos.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setRascunho({
                        ...rascunho,
                        segmentos: marcado
                          ? rascunho.segmentos.filter((x) => x !== s.id)
                          : [...rascunho.segmentos, s.id],
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium",
                      marcado
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Nada marcado = todos os nichos.</p>
          </section>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--primary)]"
              checked={rascunho.soComEstoque}
              onChange={(ev) => setRascunho({ ...rascunho, soComEstoque: ev.target.checked })}
            />
            <span>Só pedidos de itens que tenho disponíveis</span>
          </label>

          {e && filtroAtivo(rascunho) && (
            <div
              className={cn(
                "flex gap-3 rounded-lg border p-4",
                mudouATaxa ? "border-warning/50 bg-warning/5" : "border-border",
              )}
            >
              <TriangleAlert
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  mudouATaxa ? "text-warning" : "text-muted-foreground",
                )}
              />
              <div className="text-sm">
                {e.escondidos === 0 ? (
                  <p className="font-semibold">
                    Nos últimos 90 dias, nenhum pedido seria escondido por esses filtros.
                  </p>
                ) : (
                  <>
                    <p className="font-semibold">
                      Isso esconderia {e.escondidos} de {e.total} pedidos dos últimos 90 dias
                    </p>
                    {e.valorEscondido > 0 && (
                      <p className="text-muted-foreground">
                        São {brl(e.valorEscondido)} estimados que você não veria.
                      </p>
                    )}
                    {mudouATaxa && (
                      <p className="mt-1">
                        Se você só respondesse os que sobram, sua taxa de resposta iria de{" "}
                        <strong>{pct(e.taxaAtual)}</strong> para{" "}
                        <strong className="text-warning">{pct(e.taxaComFiltro)}</strong>
                        {e.posicaoAtual &&
                        e.posicaoComFiltro &&
                        e.posicaoAtual.posicao !== e.posicaoComFiltro.posicao
                          ? `, e sua posição na região de ${e.posicaoAtual.posicao}º para ${e.posicaoComFiltro.posicao}º`
                          : ""}
                        .
                      </p>
                    )}
                  </>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Pedido escondido e não respondido continua contando contra a sua taxa.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setRascunho(SEM_FILTRO)}>
              Limpar
            </Button>
            <Button
              className="flex-[2]"
              disabled={salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending ? "Salvando..." : "Salvar filtros"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
