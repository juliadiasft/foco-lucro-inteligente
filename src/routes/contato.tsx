import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin } from "lucide-react";
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
            <li className="flex items-center gap-3"><Mail className="h-5 w-5 text-primary" /> contato@centraldocomerciante.com.br</li>
            <li className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" /> (11) 4000-0000</li>
            <li className="flex items-center gap-3"><MapPin className="h-5 w-5 text-primary" /> São Paulo, Brasil</li>
          </ul>
        </div>
        <Card className="p-8 shadow-elegant bg-gradient-card">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast.success("Mensagem enviada! Em breve entraremos em contato."); }}>
            <div className="space-y-1.5"><Label htmlFor="n">Nome</Label><Input id="n" required /></div>
            <div className="space-y-1.5"><Label htmlFor="e">Email</Label><Input id="e" type="email" required /></div>
            <div className="space-y-1.5"><Label htmlFor="emp">Empresa</Label><Input id="emp" /></div>
            <div className="space-y-1.5"><Label htmlFor="m">Mensagem</Label><Textarea id="m" rows={5} required /></div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">Enviar mensagem</Button>
          </form>
        </Card>
      </section>
    </SiteLayout>
  );
}
