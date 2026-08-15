import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listCustomers } from "@/lib/api/staff.functions";
import { dataBR, num } from "@/lib/format";

export const Route = createFileRoute("/adm/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Back office" }] }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const [search, setSearch] = useState("");
  const [accountType, setAccountType] = useState("");
  const [status, setStatus] = useState("");

  const list = useMutation({
    mutationFn: () =>
      listCustomers({
        data: {
          search: search || undefined,
          accountType: (accountType || undefined) as "comerciante" | undefined,
          status: status || undefined,
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    list.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = list.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Comerciantes e fornecedores. Cada consulta feita aqui fica registrada na auditoria.
        </p>
      </div>

      <Card className="p-5 grid gap-4 md:grid-cols-[1fr_10rem_10rem_auto]">
        <Input
          placeholder="Buscar por nome da empresa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") list.mutate();
          }}
        />
        <select
          value={accountType}
          onChange={(event) => setAccountType(event.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          <option value="">Todos os tipos</option>
          <option value="comerciante">Comerciante</option>
          <option value="fornecedor">Fornecedor</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          <option value="">Todas as situações</option>
          <option value="trialing">Em teste</option>
          <option value="active">Ativo</option>
          <option value="past_due">Pagamento pendente</option>
          <option value="canceled">Cancelado</option>
        </select>
        <Button disabled={list.isPending} onClick={() => list.mutate()}>
          <Search className="h-4 w-4 mr-1" />
          {list.isPending ? "Buscando..." : "Buscar"}
        </Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="p-3 font-medium">Empresa</th>
              <th className="p-3 font-medium">Tipo</th>
              <th className="p-3 font-medium">Plano</th>
              <th className="p-3 font-medium">Situação</th>
              <th className="p-3 font-medium">Onde</th>
              <th className="p-3 font-medium text-right">Usuários</th>
              <th className="p-3 font-medium text-right">Itens</th>
              <th className="p-3 font-medium">Desde</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="p-3">
                    <Link
                      to="/adm/cliente/$id"
                      params={{ id: row.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.ownerEmail}</p>
                  </td>
                  <td className="p-3 capitalize">{row.accountType}</td>
                  <td className="p-3 capitalize">{row.plan}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{row.subscriptionStatus}</Badge>
                    {row.subscriptionStatus === "trialing" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        até {dataBR(row.trialEndsAt)}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.city ? `${row.city}${row.uf ? ` — ${row.uf}` : ""}` : "—"}
                  </td>
                  <td className="p-3 text-right">{num(row.usuarios)}</td>
                  <td className="p-3 text-right">{num(row.itens)}</td>
                  <td className="p-3 text-muted-foreground">{dataBR(row.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Esta tela não mostra custo, margem, venda nem conteúdo de conversa dos clientes. Esses dados
        pertencem a eles.
      </p>
    </div>
  );
}
