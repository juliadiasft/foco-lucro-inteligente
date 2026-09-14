import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelInvitation,
  createInvitation,
  listTeam,
  updateTeamMember,
} from "@/lib/api/team.functions";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Central do Comerciante" }] }),
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "operator">("operator");
  const [inviteUrl, setInviteUrl] = useState("");
  const { data } = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team"] });
  const invite = useMutation({
    mutationFn: () => createInvitation({ data: { email, role } }),
    onSuccess: async (result) => {
      setInviteUrl(result.inviteUrl);
      await refresh();
      toast.success("Convite criado! Copie o link e envie à pessoa.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; role: "admin" | "operator"; active: boolean }) =>
      updateTeamMember({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelInvitation({ data: { id } }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copiado!");
  };
  const members = data?.members || [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Equipe</h1>
          <p className="text-muted-foreground">
            Controle quem acessa a empresa e o nível de permissão.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setInviteUrl("");
              setEmail("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={(data?.usedSeats || 0) >= (data?.limit || 0)}>
              <UserPlus className="h-4 w-4 mr-1" /> Convidar pessoa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar para a equipe</DialogTitle>
            </DialogHeader>
            {inviteUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Envie este link à pessoa. Ele expira em 7 dias.
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={inviteUrl} />
                  <Button size="icon" onClick={copy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Concluir
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Permissão</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => setRole(value as "admin" | "operator")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operador — vendas e cadastros</SelectItem>
                      <SelectItem value="admin">Administrador — acesso completo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button disabled={invite.isPending || !email} onClick={() => invite.mutate()}>
                  Criar convite
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <Card className="p-4">
        <div className="flex gap-2 items-center">
          <Users className="h-5 w-5 text-primary" />
          <p className="font-medium">
            {members.filter((m) => m.active).length} de {data?.limit || 0} vagas ocupadas ou
            reservadas
          </p>
        </div>
        {(data?.usedSeats || 0) >= (data?.limit || 0) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Limite do plano atingido. Desative uma pessoa ou cancele um convite pendente.
          </p>
        )}
      </Card>
      {/* Lista, e não tabela: no celular a tabela de quatro colunas rolava de lado
          e o botão de desativar ficava fora da tela. */}
      <ul className="divide-y divide-border border-y border-border">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{member.name}</span>
                {!member.active && <Badge variant="secondary">Desativado</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            </div>
            {member.role === "owner" ? (
              <span className="text-sm text-muted-foreground">Proprietário</span>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    update.mutate({
                      id: member.id,
                      role: value as "admin" | "operator",
                      active: member.active,
                    })
                  }
                >
                  <SelectTrigger className="h-10 w-36" aria-label={`Perfil de ${member.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() =>
                    update.mutate({
                      id: member.id,
                      role: member.role as "admin" | "operator",
                      active: !member.active,
                    })
                  }
                >
                  {member.active ? (
                    <X className="mr-1 h-4 w-4" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  {member.active ? "Desativar" : "Ativar"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!!data?.invites.length && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Convites pendentes</h2>
          <div className="space-y-2">
            {data.invites.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center border rounded-lg p-3"
              >
                <div>
                  <p className="font-medium text-sm">{item.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.role === "admin" ? "Administrador" : "Operador"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => cancel.mutate(item.id)}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
