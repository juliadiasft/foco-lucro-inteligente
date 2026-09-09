import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Building2, Mail, Phone, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dataBR } from "@/lib/format";
import { listSupplierVerifications, setSupplierVerification } from "@/lib/api/staff.functions";

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
          O CNAE aprova sozinho quem é atacadista ou indústria. Cai aqui quem tem outro CNAE, quem
          se cadastrou com CPF, ou quem entrou quando a Receita estava fora do ar. Enquanto espera,
          o fornecedor usa o painel normalmente — só não consegue publicar a vitrine.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !fila.length ? (
        <Card className="p-8 text-center">
          <BadgeCheck className="h-8 w-8 mx-auto text-success" />
          <p className="font-medium mt-3">Nenhum fornecedor esperando.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Todo mundo que se cadastrou passou pelo CNAE automaticamente.
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

              {/* O motivo de estar na fila, sem obrigar quem revisa a consultar
                  o CNPJ de novo por fora. */}
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
