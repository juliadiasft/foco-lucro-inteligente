import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, PhoneCall } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listSupplierLeads } from "@/lib/api/staff.functions";
import { dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/adm/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores procurados — Back office" }] }),
  component: AdminSupplierLeads,
});

function AdminSupplierLeads() {
  const { data } = useQuery({
    queryKey: ["supplier-leads"],
    queryFn: () => listSupplierLeads(),
  });

  const rows = data || [];
  const pendentes = rows.filter((row) => !row.alreadyOnPlatform);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Fornecedores procurados</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Empresas citadas por comerciantes que buscaram e não encontraram. Quanto mais comerciantes
          citaram o mesmo nome, mais forte é o argumento para ligar.
        </p>
      </div>

      {!rows.length ? (
        <Card className="p-8 text-center">
          <PhoneCall className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhuma indicação ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Elas aparecem aqui quando um comerciante busca em Onde comprar, não acha nada e conta de
            quem compra hoje.
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase text-primary">Para ligar</p>
            <p className="text-2xl font-bold mt-1">{pendentes.length}</p>
            <p className="text-sm text-muted-foreground mt-1">
              De {rows.length} fornecedor(es) citado(s) no total.
            </p>
          </Card>

          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.supplierKey} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{row.supplierName}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {row.merchants} comerciante(s) citaram · última em {dataHoraBR(row.lastAt)}
                    </p>
                  </div>
                  {row.alreadyOnPlatform ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Já está na Central
                    </Badge>
                  ) : (
                    <Badge className="bg-warning/15 text-warning border-warning/30">Ligar</Badge>
                  )}
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Onde</dt>
                    <dd className="mt-0.5">{row.cities.join(" · ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Compram dele</dt>
                    <dd className="mt-0.5">{row.products.join(" · ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Buscavam por</dt>
                    <dd className="mt-0.5">{row.searches.join(" · ") || "—"}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
