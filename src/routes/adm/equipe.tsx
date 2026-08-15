import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listStaff, setStaffActive } from "@/lib/api/staff.functions";
import { dataBR } from "@/lib/format";

export const Route = createFileRoute("/adm/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Back office" }] }),
  component: StaffTeam,
});

const roleLabels: Record<string, string> = {
  admin: "Administrador — acesso total",
  financeiro: "Financeiro — receita e cobrança",
  suporte: "Suporte — apenas lista de clientes",
};

function StaffTeam() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["staff-team"],
    queryFn: () => listStaff(),
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setStaffActive({ data: { id, active } }),
    onSuccess: async () => {
      toast.success("Equipe atualizada");
      await queryClient.invalidateQueries({ queryKey: ["staff-team"] });
    },
    onError: (reason: Error) => toast.error(reason.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Equipe</h1>
        <p className="text-muted-foreground mt-1">
          Quem tem acesso ao back office e com qual permissão.
        </p>
      </div>

      {error ? (
        <Card className="p-6 text-sm">{error.message}</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-3 font-medium">Pessoa</th>
                <th className="p-3 font-medium">Permissão</th>
                <th className="p-3 font-medium">Situação</th>
                <th className="p-3 font-medium">Desde</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(data || []).map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="p-3 text-xs">{roleLabels[row.role] || row.role}</td>
                  <td className="p-3">
                    <Badge variant={row.active ? "secondary" : "destructive"}>
                      {row.active ? "ativa" : "desativada"}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{dataBR(row.createdAt)}</td>
                  <td className="p-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: row.id, active: !row.active })}
                    >
                      {row.active ? "Desativar" : "Reativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-5">
        <p className="font-medium">Como criar uma conta nova</p>
        <p className="text-sm text-muted-foreground mt-1">
          Contas do back office são criadas por linha de comando, de propósito: não existe conta
          padrão e nenhuma senha fica guardada em variável de ambiente.
        </p>
        <pre className="mt-3 rounded-lg bg-muted p-3 text-xs overflow-x-auto">
          node scripts/create-staff.mjs &quot;email@dominio.com&quot; &quot;Nome&quot;
          &quot;senha-forte&quot; suporte
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          Permissões possíveis: admin, financeiro ou suporte. Desativar aqui encerra as sessões
          abertas da pessoa na hora.
        </p>
      </Card>
    </div>
  );
}
