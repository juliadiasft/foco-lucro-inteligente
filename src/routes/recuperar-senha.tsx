import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — Central do Comerciante" }] }),
  component: Recuperar,
});

function Recuperar() {
  return (
    <SiteLayout>
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-md">
        <Card className="p-8 shadow-elegant bg-gradient-card">
          <h1 className="text-2xl font-bold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Informe seu email e enviaremos um link para redefinir sua senha.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => { e.preventDefault(); toast.success("Se o email existir, enviaremos as instruções."); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required />
            </div>
            <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">Enviar link</Button>
          </form>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">Voltar para o login</Link>
          </p>
        </Card>
      </section>
    </SiteLayout>
  );
}
