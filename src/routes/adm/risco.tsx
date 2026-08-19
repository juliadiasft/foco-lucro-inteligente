import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Mail, Phone, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listChurnRisk } from "@/lib/api/staff.functions";
import { accountTypeLabels } from "@/lib/account";
import { planLabels } from "@/lib/plans";

export const Route = createFileRoute("/adm/risco")({
  head: () => ({ meta: [{ title: "Risco de cancelamento — Back office" }] }),
  component: AdminChurnRisk,
});

const estiloNivel = {
  alto: "bg-destructive/15 text-destructive border-destructive/30",
  medio: "bg-warning/15 text-warning border-warning/30",
  baixo: "bg-muted text-muted-foreground border-border",
} as const;

const rotuloNivel = { alto: "Ligar hoje", medio: "Acompanhar", baixo: "Observar" } as const;

function AdminChurnRisk() {
  const { data } = useQuery({ queryKey: ["churn-risk"], queryFn: () => listChurnRisk() });
  const clientes = data?.clientes || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Risco de cancelamento</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Quem assinou e ainda não usou é quem cancela no primeiro boleto. Esta lista mostra isso
          antes de acontecer, para dar tempo de ligar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-destructive">Ligar hoje</p>
          <p className="text-3xl font-bold mt-1">{data?.resumo.alto ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">Risco alto de sair</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-warning">Nunca ativaram</p>
          <p className="text-3xl font-bold mt-1">{data?.resumo.semAtivacao ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">Sem nenhum produto ou oferta</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Em risco</p>
          <p className="text-3xl font-bold mt-1">
            {data?.resumo.emRisco ?? "—"}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              de {data?.resumo.total ?? "—"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">Com pelo menos um sinal</p>
        </Card>
      </div>

      {!clientes.length ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto text-success" />
          <p className="font-medium mt-3">Ninguém em risco no momento.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ou a base ainda está pequena demais para gerar sinal. Volte aqui quando os primeiros
            clientes completarem uma semana.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {clientes.map((cliente) => (
            <Card key={cliente.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/adm/cliente/$id"
                      params={{ id: cliente.id }}
                      className="font-semibold hover:underline"
                    >
                      {cliente.name}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {accountTypeLabels[cliente.accountType]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {planLabels[cliente.plan]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {cliente.cidade || "Sem cidade"} · {cliente.itens} item(ns) ·{" "}
                    {cliente.diasSemEntrar === null
                      ? "nunca entrou"
                      : `entrou há ${cliente.diasSemEntrar} dia(s)`}
                  </p>
                </div>
                <Badge className={estiloNivel[cliente.nivel as keyof typeof estiloNivel]}>
                  {rotuloNivel[cliente.nivel as keyof typeof rotuloNivel]}
                </Badge>
              </div>

              <ul className="mt-3 space-y-1.5">
                {cliente.motivos.map((motivo, indice) => (
                  <li key={indice} className="flex gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                    {motivo}
                  </li>
                ))}
              </ul>

              {(cliente.phone || cliente.email) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {cliente.phone && (
                    <a
                      href={`tel:${cliente.phone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {cliente.phone}
                    </a>
                  )}
                  {cliente.email && (
                    <a
                      href={`mailto:${cliente.email}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {cliente.email}
                    </a>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
