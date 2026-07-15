import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Central do Comerciante" }] }),
  component: Cadastro,
});

function Cadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: "", empresa: "", telefone: "", email: "", senha: "", conf: "" });

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.senha !== form.conf) return toast.error("As senhas não conferem");
    if (form.senha.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { nome: form.nome, empresa: form.empresa, telefone: form.telefone },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message.includes("registered") ? "Este email já está cadastrado" : error.message);
      return;
    }
    // Garante sessão iniciada (auto-confirm ativo)
    const { error: eLogin } = await supabase.auth.signInWithPassword({ email: form.email, password: form.senha });
    setLoading(false);
    if (eLogin) {
      toast.error("Conta criada. Faça login para continuar.");
      navigate({ to: "/login" });
      return;
    }
    toast.success("Conta criada! Bem-vindo à Central do Comerciante");
    navigate({ to: "/onboarding" });
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) toast.error("Não foi possível cadastrar com Google");
  };

  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="order-2 lg:order-1">
          <h1 className="text-3xl md:text-5xl font-bold">Comece grátis em 2 minutos.</h1>
          <p className="mt-4 text-muted-foreground text-lg">
            14 dias para descobrir onde seu comércio está perdendo dinheiro.
          </p>
          <ul className="mt-6 space-y-3">
            {["Sem cartão de crédito", "Cancele quando quiser", "Acesso a todos os recursos", "Consultor de Lucro IA incluído"].map((x) => (
              <li key={x} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" /> {x}</li>
            ))}
          </ul>
        </div>

        <Card className="order-1 lg:order-2 p-8 shadow-elegant bg-gradient-card">
          <h2 className="text-xl font-bold">Criar conta</h2>

          <Button type="button" variant="outline" className="w-full mt-4" onClick={google}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Cadastrar com Google
          </Button>

          <div className="relative my-5"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div></div>

          <form className="space-y-4" onSubmit={criar}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="nome">Nome</Label><Input id="nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="empresa">Nome da empresa</Label><Input id="empresa" required value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="tel">Telefone</Label><Input id="tel" type="tel" placeholder="(11) 99999-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label htmlFor="senha">Senha</Label><Input id="senha" type="password" required value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="conf">Confirmar senha</Label><Input id="conf" type="password" required value={form.conf} onChange={(e) => setForm({ ...form, conf: e.target.value })} /></div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-hero text-primary-foreground">{loading ? "Criando conta..." : "Criar conta grátis"}</Button>
            <p className="text-xs text-center text-muted-foreground">
              Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        </Card>
      </section>
    </SiteLayout>
  );
}
