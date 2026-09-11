import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contato")({
  head: () => ({ meta: [{ title: "Contato — Central do Comerciante" }] }),
  component: Contato,
});

function Contato() {
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-20 grid lg:grid-cols-2 gap-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold">Fale com a gente</h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Tire dúvidas, peça uma demonstração ou converse com nossa equipe.
          </p>
          <ul className="mt-8 space-y-4">
            <li className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" /> centraldocomerciante@gmail.com
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" /> Atendendo todo o Brasil
            </li>
          </ul>
        </div>
        <Card className="p-8 shadow-elegant bg-gradient-card">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const subject = `Contato pelo site — ${form.get("empresa") || form.get("nome")}`;
              const body = `Nome: ${form.get("nome")}\nEmail: ${form.get("email")}\nEmpresa: ${form.get("empresa") || "Não informada"}\n\n${form.get("mensagem")}`;
              window.location.href = `mailto:centraldocomerciante@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              toast.info("Seu aplicativo de email foi aberto para concluir o envio.");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="n">Nome</Label>
              <Input id="n" name="nome" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e">Email</Label>
              <Input id="e" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp">Empresa</Label>
              <Input id="emp" name="empresa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m">Mensagem</Label>
              <Textarea id="m" name="mensagem" rows={5} required />
            </div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">
              Continuar por email
            </Button>
          </form>
        </Card>
      </section>
    </SiteLayout>
  );
}
