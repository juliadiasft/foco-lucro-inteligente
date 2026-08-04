import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAccount } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Central do Comerciante" }] }),
  component: Cadastro,
});

function Cadastro() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    password: "",
    confirmation: "",
    acceptedTerms: false,
  });

  const criar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmation) return toast.error("As senhas não conferem");
    if (form.password.length < 8) return toast.error("A senha deve ter no mínimo 8 caracteres");
    setLoading(true);
    try {
      await registerAccount({
        data: {
          name: form.name,
          company: form.company,
          phone: form.phone || undefined,
          email: form.email,
          password: form.password,
          acceptedTerms: form.acceptedTerms as true,
        },
      });
      toast.success("Conta criada! Vamos configurar seu negócio.");
      window.location.href = "/onboarding";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="order-2 lg:order-1">
          <h1 className="text-3xl md:text-5xl font-bold">
            Organize seu comércio em poucos minutos.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Comece com 14 dias no plano Profissional, sem informar cartão.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Produtos, estoque e PDV",
              "Painel de vendas e metas",
              "Assistente de Lucro com IA",
              "Dados separados por empresa",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <Card className="order-1 lg:order-2 p-8 shadow-elegant bg-gradient-card">
          <h2 className="text-xl font-bold">Criar conta</h2>
          <form className="space-y-4 mt-5" onSubmit={criar}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Nome da empresa</Label>
                <Input
                  id="company"
                  required
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmation">Confirmar senha</Label>
                <Input
                  id="confirmation"
                  type="password"
                  minLength={8}
                  required
                  value={form.confirmation}
                  onChange={(e) => setForm({ ...form, confirmation: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="acceptedTerms"
                checked={form.acceptedTerms}
                onCheckedChange={(checked) => setForm({ ...form, acceptedTerms: checked === true })}
              />
              <Label htmlFor="acceptedTerms" className="text-xs font-normal leading-5">
                Li e aceito os{" "}
                <Link to="/termos" className="text-primary underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/privacidade" className="text-primary underline">
                  Política de Privacidade
                </Link>
                , incluindo o uso de dados operacionais pelo Consultor de IA.
              </Label>
            </div>
            <Button
              type="submit"
              disabled={loading || !form.acceptedTerms}
              className="w-full bg-gradient-hero text-primary-foreground"
            >
              {loading ? "Criando conta..." : "Criar conta e começar"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </Card>
      </section>
    </SiteLayout>
  );
}
