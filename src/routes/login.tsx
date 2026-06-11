import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Central do Comerciante" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [show, setShow] = useState(false);
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-md">
        <Card className="p-8 shadow-elegant bg-gradient-card">
          <h1 className="text-2xl font-bold">Entrar na sua conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Bem-vindo de volta, comerciante!</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              toast.info("Ative o Lovable Cloud para habilitar o login real.");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="voce@empresa.com.br" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input id="senha" type={show ? "text" : "password"} placeholder="••••••••" required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Mostrar senha">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2"><Checkbox /> Lembrar acesso</label>
              <Link to="/recuperar-senha" className="text-primary hover:underline">Esqueci a senha</Link>
            </div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">Entrar</Button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            Ainda não tem conta? <Link to="/cadastro" className="text-primary font-medium hover:underline">Cadastre-se grátis</Link>
          </p>
        </Card>
      </section>
    </SiteLayout>
  );
}
