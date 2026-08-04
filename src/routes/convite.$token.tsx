import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitation, getInvitation } from "@/lib/api/team.functions";

export const Route = createFileRoute("/convite/$token")({ component: InvitePage });
function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    acceptedTerms: false,
  });
  const { data, error, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInvitation({ data: { token } }),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () =>
      acceptInvitation({
        data: { token, ...form, acceptedTerms: form.acceptedTerms as true },
      }),
    onSuccess: () => {
      toast.success("Conta criada!");
      navigate({ to: "/dashboard" });
    },
    onError: (reason: Error) => toast.error(reason.message),
  });
  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6">
        <Users className="h-10 w-10 text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-center mt-3">Convite para a equipe</h1>
        {isLoading ? (
          <p className="text-center mt-4">Carregando...</p>
        ) : error ? (
          <p className="text-center text-destructive mt-4">{(error as Error).message}</p>
        ) : (
          <div className="space-y-4 mt-5">
            <p className="text-sm text-muted-foreground text-center">
              Você foi convidado para <strong>{data?.companyName}</strong> como{" "}
              {data?.role === "admin" ? "administrador" : "operador"}. O acesso será criado para{" "}
              {data?.email}.
            </p>
            <Field label="Seu nome">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Telefone (opcional)">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Crie uma senha">
              <Input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <div className="flex items-start gap-2">
              <Checkbox
                id="inviteTerms"
                checked={form.acceptedTerms}
                onCheckedChange={(checked) => setForm({ ...form, acceptedTerms: checked === true })}
              />
              <Label htmlFor="inviteTerms" className="text-xs font-normal leading-5">
                Aceito os{" "}
                <Link to="/termos" className="text-primary underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/privacidade" className="text-primary underline">
                  Política de Privacidade
                </Link>
                .
              </Label>
            </div>
            <Button
              className="w-full"
              disabled={
                accept.isPending ||
                form.name.length < 2 ||
                form.password.length < 8 ||
                !form.acceptedTerms
              }
              onClick={() => accept.mutate()}
            >
              Entrar na equipe
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
