import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Gift, Lock, Truck } from "lucide-react";
import { useState } from "react";

import { Mascote, type Movimento, type Pose } from "@/components/app/Mascote";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { getPremiacao, salvarEnderecoDeEntrega } from "@/lib/api/premiacao.functions";
import { brl, dataBR } from "@/lib/format";
import { COMO_CONTA, DEGRAUS, type EstadoDaPremiacao } from "@/lib/premiacao";
import { cn } from "@/lib/utils";

const CHAVE = ["premiacao"];

// A pose do mascote conta a história: andando rumo ao primeiro degrau,
// gráfico quando já tem resultado, joinha quando conquistou, e comemoração
// (só na abertura em que a conquista aconteceu).
function poseEMovimento(estado: EstadoDaPremiacao, novo: boolean): [Pose, Movimento] {
  if (novo) return ["aceno", "comemorar"];
  if (estado.atual) return ["joinha", "flutuar"];
  if (estado.total > 0) return ["grafico", "flutuar"];
  return ["andando", "andar"];
}

/** Barra + quanto falta. Serve à tela e ao cartão do Painel. */
function Barra({ estado }: { estado: EstadoDaPremiacao }) {
  if (!estado.proximo) return <p className="text-sm font-medium">Você chegou ao último degrau.</p>;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold tabular-nums">{brl(estado.total)}</span>
        <span className="text-muted-foreground">meta {estado.proximo.rotulo}</span>
      </div>
      <Progress
        value={estado.progressoPct}
        aria-label={`${estado.progressoPct}% da próxima meta`}
      />
      <p className="text-xs text-muted-foreground">
        Faltam <strong className="tabular-nums">{brl(estado.falta)}</strong>
        {estado.proximo.premioFisico && " para ganhar o mascotinho da Central em casa"}
      </p>
    </div>
  );
}

/** Cartão pequeno para o Painel dos dois lados. */
export function CartaoDeConquista({ para }: { para: "/conquistas" | "/fornecedor/conquistas" }) {
  const { data } = useQuery({ queryKey: CHAVE, queryFn: () => getPremiacao() });
  if (!data) return null;
  const [pose, movimento] = poseEMovimento(data.estado, false);
  return (
    <Link to={para} className="block">
      <Card className="flex items-center gap-4 p-4 hover:bg-muted/40">
        <Mascote pose={pose} movimento={movimento} className="h-20 w-20 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suas conquistas
          </p>
          <Barra estado={data.estado} />
        </div>
      </Card>
    </Link>
  );
}

type Endereco = {
  destinatario: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};
const VAZIO: Endereco = {
  destinatario: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

function FormularioDeEntrega({
  inicial,
  aoSalvar,
}: {
  inicial: Endereco | null;
  aoSalvar: (e: Endereco) => void;
}) {
  const [f, setF] = useState<Endereco>(inicial ?? VAZIO);
  const campo = (id: keyof Endereco, rotulo: string, extra?: string) => (
    <div className={cn("space-y-1", extra)}>
      <Label htmlFor={`e-${id}`}>{rotulo}</Label>
      <Input id={`e-${id}`} value={f[id]} onChange={(e) => setF({ ...f, [id]: e.target.value })} />
    </div>
  );
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar(f);
      }}
    >
      {campo("destinatario", "Quem recebe", "sm:col-span-4")}
      {campo("telefone", "Telefone", "sm:col-span-2")}
      {campo("cep", "CEP", "sm:col-span-2")}
      {campo("logradouro", "Rua", "sm:col-span-4")}
      {campo("numero", "Número", "sm:col-span-2")}
      {campo("complemento", "Complemento (opcional)", "sm:col-span-4")}
      {campo("bairro", "Bairro", "sm:col-span-3")}
      {campo("cidade", "Cidade", "sm:col-span-2")}
      {campo("uf", "UF", "sm:col-span-1")}
      <div className="sm:col-span-6">
        <Button type="submit">Enviar endereço</Button>
      </div>
    </form>
  );
}

export function TelaDeConquistas({ lado }: { lado: "comerciante" | "fornecedor" }) {
  const { user } = useAuth();
  const cliente = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: CHAVE, queryFn: () => getPremiacao() });
  const [editando, setEditando] = useState(false);
  const salvar = useMutation({
    mutationFn: (e: Endereco) => salvarEnderecoDeEntrega({ data: { degrau: 10_000, ...e } }),
    onSuccess: () => {
      setEditando(false);
      cliente.invalidateQueries({ queryKey: CHAVE });
    },
  });
  const podeInformar = user?.role === "owner" || user?.role === "admin";

  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;
  const { estado, conquistas, novos } = data;
  const [pose, movimento] = poseEMovimento(estado, novos.length > 0);
  const daEmpresa = (valor: number) => conquistas.find((c) => c.degrau === valor);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Conquistas</h1>
        <p className="text-muted-foreground">
          Você sobe de degrau pelo resultado que a Central gerou para o seu negócio.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-4 p-5 sm:flex-row">
        <Mascote pose={pose} movimento={movimento} className="h-36 w-36 shrink-0" />
        <div className="w-full space-y-2">
          {novos.length > 0 && (
            <p className="rounded-lg bg-success/10 p-3 text-sm font-semibold text-success">
              Conquista nova: {DEGRAUS.find((d) => d.valor === novos[novos.length - 1])?.rotulo}!
            </p>
          )}
          <Barra estado={estado} />
          <p className="text-xs text-muted-foreground">{COMO_CONTA[lado]}</p>
        </div>
      </Card>

      <ol className="space-y-3">
        {DEGRAUS.map((d) => {
          const c = daEmpresa(d.valor);
          const alcancado = estado.total >= d.valor || !!c;
          return (
            <li key={d.valor}>
              <Card className={cn("p-4", alcancado ? "border-success/40" : "opacity-80")}>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      alcancado ? "bg-success text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {alcancado ? <Check className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{d.rotulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.premioFisico ? "Mascotinho da Central entregue em casa" : "Reconhecimento"}
                      {c && ` · conquistado em ${dataBR(c.conquistadaEm)}`}
                    </p>
                  </div>
                  {d.premioFisico && <Gift className="h-5 w-5 text-muted-foreground" />}
                </div>

                {d.premioFisico && c && c.entrega === "pendente" && (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-medium">
                      Parabéns! Para onde mandamos o seu mascotinho?
                    </p>
                    {podeInformar ? (
                      <FormularioDeEntrega inicial={null} aoSalvar={(e) => salvar.mutate(e)} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Peça ao dono ou administrador da conta para informar o endereço.
                      </p>
                    )}
                    {salvar.isError && (
                      <p className="mt-2 text-sm text-destructive">
                        {(salvar.error as Error).message}
                      </p>
                    )}
                  </div>
                )}

                {d.premioFisico && c && c.entrega === "endereco_enviado" && (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      <Truck className="h-4 w-4" /> Recebemos o endereço. Avisaremos quando sair.
                    </p>
                    {c.endereco && (
                      <p className="mt-1 text-muted-foreground">
                        {c.endereco.destinatario} · {c.endereco.logradouro}, {c.endereco.numero} ·{" "}
                        {c.endereco.cidade}/{c.endereco.uf}
                      </p>
                    )}
                    {podeInformar && !editando && (
                      <button
                        type="button"
                        onClick={() => setEditando(true)}
                        className="mt-1 text-primary underline"
                      >
                        Corrigir endereço
                      </button>
                    )}
                    {editando && (
                      <FormularioDeEntrega
                        inicial={c.endereco}
                        aoSalvar={(e) => salvar.mutate(e)}
                      />
                    )}
                  </div>
                )}

                {d.premioFisico && c && (c.entrega === "enviado" || c.entrega === "entregue") && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm font-medium">
                    <Truck className="h-4 w-4" />
                    {c.entrega === "enviado"
                      ? "Seu mascotinho está a caminho."
                      : "Mascotinho entregue. Obrigado por crescer com a Central!"}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
