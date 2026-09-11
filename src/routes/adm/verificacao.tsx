import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Building2, Mail, Phone, ShieldAlert, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dataBR } from "@/lib/format";
import { tempoDeEmpresa } from "@/lib/fornecedor-sinais";
import { listSupplierVerifications, setSupplierVerification } from "@/lib/api/staff.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/adm/verificacao")({
  head: () => ({ meta: [{ title: "Verificação de fornecedores — Back office" }] }),
  component: AdminVerificacao,
});

function AdminVerificacao() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-verifications"],
    queryFn: () => listSupplierVerifications(),
  });

  const decidir = useMutation({
    mutationFn: (entrada: { id: string; status: "aprovado" | "recusado" }) =>
      setSupplierVerification({ data: entrada }),
    onSuccess: async (_resultado, entrada) => {
      toast.success(entrada.status === "aprovado" ? "Fornecedor aprovado" : "Fornecedor recusado");
      await queryClient.invalidateQueries({ queryKey: ["supplier-verifications"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const fila = data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Verificação de fornecedores</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          No cadastro, a Receita é consultada e a vitrine só vai ao ar sozinha quando tudo bate:
          empresa ativa, do ramo, com tempo de casa e capital coerentes. Qualquer sinal estranho
          traz a empresa para cá, com o motivo escrito — nada é recusado sem você olhar. Enquanto
          espera, o fornecedor usa o painel normalmente; só não consegue publicar a vitrine.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !fila.length ? (
        <Card className="p-8 text-center">
          <BadgeCheck className="h-8 w-8 mx-auto text-success" />
          <p className="font-medium mt-3">Nenhum fornecedor esperando.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Todo mundo que se cadastrou passou pela conferência da Receita.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {fila.map((fornecedor) => (
            <Card key={fornecedor.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{fornecedor.nome}</span>
                    <Badge variant="outline" className="text-xs">
                      {fornecedor.itens} item(ns) no catálogo
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[fornecedor.cidade, fornecedor.uf].filter(Boolean).join(" - ") || "Sem cidade"}{" "}
                    · cadastrou em {dataBR(fornecedor.criadoEm)}
                  </p>
                </div>
                <Badge className="bg-warning/15 text-warning border-warning/30">Em análise</Badge>
              </div>

              {/* Por que está na fila, escrito, sem obrigar quem revisa a
                  consultar o CNPJ de novo por fora. O grave vem em vermelho:
                  é o que, se for verdade, impede a empresa de vender dentro
                  da lei. */}
              {fornecedor.motivos.length ? (
                <ul className="mt-3 space-y-1.5">
                  {fornecedor.motivos.map((motivo) => (
                    <li
                      key={motivo.texto}
                      className={cn(
                        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                        motivo.peso === "grave"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted/50",
                      )}
                    >
                      {motivo.peso === "grave" ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldQuestion className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                      )}
                      <span>{motivo.texto}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                // Quem se cadastrou antes de 11/09/2026 não tem motivos
                // guardados — só o CNAE.
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                  <ShieldQuestion className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <span>
                    {fornecedor.cnae ? (
                      <>
                        CNAE <strong>{fornecedor.cnae}</strong>
                        {fornecedor.cnaeDescricao ? ` — ${fornecedor.cnaeDescricao}` : ""}. Não é
                        atacado nem indústria.
                      </>
                    ) : (
                      "Sem CNAE registrado: cadastro por CPF, ou a Receita não respondeu na hora."
                    )}
                  </span>
                </div>
              )}

              {/* A ficha da Receita, para decidir sem abrir outra aba. */}
              {(fornecedor.abertaEm || fornecedor.porte || fornecedor.capital !== null) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {[
                    fornecedor.situacao && `Situação: ${fornecedor.situacao.toLowerCase()}`,
                    fornecedor.abertaEm &&
                      `aberta em ${dataBR(fornecedor.abertaEm)} (${tempoDeEmpresa(fornecedor.abertaEm)})`,
                    fornecedor.porte && fornecedor.porte.toLowerCase(),
                    fornecedor.capital !== null &&
                      `capital R$ ${fornecedor.capital.toLocaleString("pt-BR")}`,
                    fornecedor.cnaeDescricao,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {(fornecedor.email || fornecedor.telefone) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {fornecedor.telefone && (
                    <a
                      href={`tel:${fornecedor.telefone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {fornecedor.telefone}
                    </a>
                  )}
                  {fornecedor.email && (
                    <a
                      href={`mailto:${fornecedor.email}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {fornecedor.email}
                    </a>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={decidir.isPending}
                  onClick={() => decidir.mutate({ id: fornecedor.id, status: "aprovado" })}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decidir.isPending}
                  onClick={() => decidir.mutate({ id: fornecedor.id, status: "recusado" })}
                >
                  Recusar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
