import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, Store, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accountTypeDescriptions,
  accountTypeLabels,
  homePathFor,
  type AccountType,
} from "@/lib/account";
import { registerAccount } from "@/lib/api/auth.functions";
import { consultarCnpj } from "@/lib/api/cnpj.functions";
import { listSegments } from "@/lib/api/segments.functions";
import { formatBrazilianDocumentInput } from "@/lib/brazilian-document";
import { cn } from "@/lib/utils";

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Criar conta — Central do Comerciante" }] }),
  component: Cadastro,
});

function Cadastro() {
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("comerciante");
  const [segments, setSegments] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    company: "",
    city: "",
    uf: "",
    phone: "",
    document: "",
    email: "",
    password: "",
    confirmation: "",
    acceptedTerms: false,
  });

  const { data: allSegments } = useQuery({
    queryKey: ["segments"],
    queryFn: () => listSegments(),
    staleTime: 60 * 60 * 1000,
  });

  // Autopreenchimento pelo CNPJ. Dispara sozinho quando o campo chega aos 14
  // dígitos — pedir um clique a mais aqui é pedir para a pessoa não usar.
  const [cnpjConsultado, setCnpjConsultado] = useState("");
  const [avisoCnpj, setAvisoCnpj] = useState<{ texto: string; alerta: boolean } | null>(null);

  const buscaCnpj = useMutation({
    mutationFn: (cnpj: string) => consultarCnpj({ data: { cnpj } }),
    onSuccess: (dados) => {
      // Só entra onde está vazio. Ver o que você acabou de digitar ser trocado
      // por outra coisa é a forma mais rápida de perder a confiança na tela.
      setForm((atual) => ({
        ...atual,
        company: atual.company || dados.nomeEmpresa || "",
        city: atual.city || dados.cidade || "",
        uf: atual.uf || dados.uf || "",
        phone: atual.phone || dados.telefone || "",
      }));
      setSegments((atual) => (atual.length ? atual : dados.segmentosSugeridos));
      setAvisoCnpj(
        dados.ativa
          ? {
              texto: `Encontrei ${dados.razaoSocial || "a empresa"} na Receita. Confira os campos abaixo.`,
              alerta: false,
            }
          : {
              // Avisar sem barrar: a Receita demora a atualizar, e recusar
              // cadastro por um dado velho é recusar cliente de verdade.
              texto: `Na Receita esta empresa consta como ${dados.situacao}. Você pode continuar mesmo assim.`,
              alerta: true,
            },
      );
    },
    onError: (erro: Error) => setAvisoCnpj({ texto: erro.message, alerta: true }),
  });

  const toggleSegment = (id: string) =>
    setSegments((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 8),
    );

  const criar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!segments.length)
      return toast.error(
        accountType === "fornecedor"
          ? "Escolha pelo menos um nicho que você atende"
          : "Escolha o nicho do seu comércio",
      );
    if (form.password !== form.confirmation) return toast.error("As senhas não conferem");
    if (form.password.length < 8) return toast.error("A senha deve ter no mínimo 8 caracteres");
    setLoading(true);
    try {
      await registerAccount({
        data: {
          name: form.name,
          company: form.company,
          accountType,
          segments,
          city: form.city || undefined,
          uf: form.uf || undefined,
          phone: form.phone || undefined,
          document: form.document,
          email: form.email,
          password: form.password,
          acceptedTerms: form.acceptedTerms as true,
        },
      });
      toast.success("Conta criada! Vamos configurar seu negócio.");
      window.location.href =
        accountType === "fornecedor" ? homePathFor("fornecedor") : "/onboarding";
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
            {accountType === "fornecedor"
              ? "Seja encontrado por quem compra."
              : "Organize seu comércio em poucos minutos."}
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Comece com 7 dias no plano Profissional, sem informar cartão.
          </p>
          <ul className="mt-6 space-y-3">
            {(accountType === "fornecedor"
              ? [
                  "Sua vitrine para comerciantes do seu nicho",
                  "Catálogo com preço, prazo e pedido mínimo",
                  "Pedidos e conversas dentro da plataforma",
                  "Dados separados por empresa",
                ]
              : [
                  "Comparação de preços entre fornecedores",
                  "Alertas de margem baixa e reposição",
                  "Assistente de Lucro com IA",
                  "Dados separados por empresa",
                ]
            ).map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <Card className="order-1 lg:order-2 p-8 shadow-elegant bg-gradient-card">
          <h2 className="text-xl font-bold">Criar conta</h2>
          <form className="space-y-4 mt-5" onSubmit={criar}>
            <div className="space-y-2">
              <Label>Você é</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["comerciante", "fornecedor"] as const).map((type) => {
                  const Icon = type === "comerciante" ? Store : Truck;
                  const selected = accountType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAccountType(type)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium text-sm">
                        <Icon className="h-4 w-4 text-primary" />
                        {accountTypeLabels[type]}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {accountTypeDescriptions[type]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                {accountType === "fornecedor"
                  ? "Quais nichos você atende?"
                  : "Qual é o nicho do seu comércio?"}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {(allSegments || []).map((segment) => {
                  const selected = segments.includes(segment.id);
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSegment(segment.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {segment.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {accountType === "fornecedor"
                  ? "É por aqui que os comerciantes do seu nicho vão te encontrar."
                  : "Usamos isso para mostrar os fornecedores certos para você."}
              </p>
            </div>

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
              <Label htmlFor="document">CPF ou CNPJ do responsável</Label>
              <Input
                id="document"
                required
                autoComplete="off"
                inputMode="text"
                maxLength={18}
                placeholder="Digite um CPF ou CNPJ válido"
                value={form.document}
                onChange={(e) => {
                  const formatado = formatBrazilianDocumentInput(e.target.value);
                  setForm({ ...form, document: formatado });
                  const digitos = formatado.replace(/\D/g, "");
                  // 14 dígitos é CNPJ. CPF tem 11 e não tem o que consultar.
                  if (digitos.length === 14 && digitos !== cnpjConsultado) {
                    setCnpjConsultado(digitos);
                    setAvisoCnpj(null);
                    buscaCnpj.mutate(digitos);
                  }
                }}
              />
              {/* Uma caixa, não uma linha solta: quem digitou o CNPJ precisa
                  perceber na hora que a tela mudou sozinha, senão desconfia dos
                  campos que apareceram preenchidos. */}
              {buscaCnpj.isPending && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  Buscando os dados na Receita Federal...
                </div>
              )}
              {avisoCnpj && !buscaCnpj.isPending && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                    avisoCnpj.alerta
                      ? "border-warning/30 bg-warning/10 text-warning"
                      : "border-success/30 bg-success/10 text-success",
                  )}
                >
                  {avisoCnpj.alerta ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span className="min-w-0">{avisoCnpj.texto}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Digite um CNPJ e eu preencho empresa, cidade e nicho para você. Um único teste por
                documento. O número completo não fica armazenado.
              </p>
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Ex.: Campinas"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf">Estado</Label>
                <select
                  id="uf"
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                >
                  <option value="">--</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {accountType === "fornecedor"
                ? "Você aparece para comerciantes de todo o país. A cidade só ajuda quem prefere comprar perto."
                : "Serve para filtrar fornecedores próximos, quando você quiser entrega mais rápida."}
            </p>
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
