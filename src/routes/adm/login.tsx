import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { staffLogin } from "@/lib/api/staff.functions";

export const Route = createFileRoute("/adm/login")({
  head: () => ({ meta: [{ title: "Back office — Central do Comerciante" }] }),
  component: StaffLogin,
});

function StaffLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await staffLogin({ data: { email, password } });
      // Sem isto, o resultado "não logado" guardado em cache continua valendo
      // e a pessoa cai em "Área restrita" logo depois de entrar.
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      navigate({ to: "/adm" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Back office</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Acesso restrito à equipe da plataforma.
        </p>
        <form className="space-y-4 mt-6" onSubmit={entrar}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
