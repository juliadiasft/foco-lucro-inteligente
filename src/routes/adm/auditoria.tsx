import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Card } from "@/components/ui/card";
import { listAuditLog } from "@/lib/api/staff.functions";
import { dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/adm/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Back office" }] }),
  component: AuditLog,
});

function AuditLog() {
  const { data, error } = useQuery({
    queryKey: ["staff-audit"],
    queryFn: () => listAuditLog(),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Auditoria</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Tudo que a equipe fez com dado de cliente. Registrar sem poder ler não serve para nada — é
          aqui que você confere.
        </p>
      </div>

      {error ? (
        <Card className="p-6 text-sm">{error.message}</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-3 font-medium">Quando</th>
                <th className="p-3 font-medium">Quem</th>
                <th className="p-3 font-medium">Ação</th>
                <th className="p-3 font-medium">Cliente</th>
                <th className="p-3 font-medium">Detalhes</th>
                <th className="p-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {!data?.length ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhum registro ainda.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap">{dataHoraBR(row.createdAt)}</td>
                    <td className="p-3">{row.staffEmail || "—"}</td>
                    <td className="p-3 font-medium">{row.action}</td>
                    <td className="p-3">{row.companyName || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                      {row.details}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{row.ipAddress || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
