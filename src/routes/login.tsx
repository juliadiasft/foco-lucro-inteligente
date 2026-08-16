import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homePathFor } from "@/lib/account";
import { loginAccount } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Central do Comerciante" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const entrar = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { accountType } = await loginAccount({ data: { email, password } });
      toast.success("Bem-vindo de volta!");
      window.location.href = homePathFor(accountType);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-md">
        <Card className="p-8 shadow-elegant bg-gradient-card">
          <h1 className="text-2xl font-bold">Entrar na sua conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Bem-vindo de volta, comerciante!</p>

          <form className="space-y-4 mt-6" onSubmit={entrar}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@empresa.com.br"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Mostrar senha"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="text-right text-sm">
              <Link to="/recuperar-senha" className="text-primary hover:underline">
                Esqueci a senha
              </Link>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-hero text-primary-foreground"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="text-primary font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </Card>
      </section>
    </SiteLayout>
  );
}
