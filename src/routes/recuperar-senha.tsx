import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/api/password.functions";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — Central do Comerciante" }] }),
  component: Recuperar,
});

function Recuperar() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset({ data: { email } });
      toast.success("Se o email estiver cadastrado, você receberá um link de recuperação.");
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
          <h1 className="text-2xl font-bold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enviaremos um link para redefinir sua senha.
          </p>
          <form onSubmit={enviar} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-hero text-primary-foreground"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-center">
            <Link to="/login" className="text-primary hover:underline">
              Voltar para login
            </Link>
          </p>
        </Card>
      </section>
    </SiteLayout>
  );
}
