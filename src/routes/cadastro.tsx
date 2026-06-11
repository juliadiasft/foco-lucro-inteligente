import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Central do Comerciante" }] }),
  component: Cadastro,
});

function Cadastro() {
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
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Cadastro recebido! Ative o Lovable Cloud para criar contas reais.");
            }}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Nome da empresa</Label>
                <Input id="empresa" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" type="tel" placeholder="(11) 99999-0000" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf">Confirmar senha</Label>
                <Input id="conf" type="password" required />
              </div>
            </div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">Criar conta grátis</Button>
            <p className="text-xs text-center text-muted-foreground">
              Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        </Card>
      </section>
    </SiteLayout>
  );
}
