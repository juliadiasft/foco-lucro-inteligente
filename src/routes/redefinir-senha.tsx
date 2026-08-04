import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { resetPassword } from "@/lib/api/password.functions";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Nova senha — Central do Comerciante" }] }),
  component: Redefinir,
});

function Redefinir() {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { token } = Route.useSearch();

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error("Link de recuperação inválido");
    if (senha.length < 8) return toast.error("Senha deve ter no mínimo 8 caracteres");
    setLoading(true);
    try {
      await resetPassword({ data: { token, password: senha } });
      toast.success("Senha alterada com sucesso!");
      navigate({ to: "/login" });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-md">
        <Card className="p-8 shadow-elegant bg-gradient-card">
          <h1 className="text-2xl font-bold">Definir nova senha</h1>
          <form onSubmit={salvar} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-hero text-primary-foreground"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </Card>
      </section>
    </SiteLayout>
  );
}
