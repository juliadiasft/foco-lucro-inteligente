import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Star, Store, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCompanyProfile,
  listSegments,
  updateCompanyProfile,
} from "@/lib/api/segments.functions";
import { listReceivedReviews } from "@/lib/api/reviews.functions";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fornecedor/")({
  head: () => ({ meta: [{ title: "Painel do fornecedor — Central do Comerciante" }] }),
  component: SupplierHome,
});

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

function SupplierHome() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => getCompanyProfile(),
  });
  const { data: allSegments } = useQuery({
    queryKey: ["segments"],
    queryFn: () => listSegments(),
    staleTime: 60 * 60 * 1000,
  });
  const { data: avaliacoes } = useQuery({
    queryKey: ["received-reviews"],
    queryFn: () => listReceivedReviews(),
  });

  const [segments, setSegments] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => {
    if (!profile) return;
    setSegments(profile.segments.map((segment) => segment.id));
    setCity(profile.city || "");
    setUf(profile.uf || "");
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateCompanyProfile({
        data: { segments, city: city || undefined, uf: uf || undefined },
      }),
    onSuccess: async () => {
      toast.success("Cadastro atualizado");
      await queryClient.invalidateQueries({ queryKey: ["company-profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (id: string) =>
    setSegments((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 8),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Olá, {profile?.name || "fornecedor"}!</h1>
        <p className="text-muted-foreground mt-1">
          Quanto mais completo o seu cadastro, mais fácil o comerciante te encontrar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <Store className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Comerciantes no seu nicho</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{num(profile?.audienceCount)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Já cadastrados na Central nos nichos que você atende
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <Tag className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Nichos atendidos</h2>
          </div>
          <p className="text-3xl font-bold mt-3">{num(profile?.segments.length)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {profile?.segments.map((segment) => segment.name).join(", ") || "Nenhum ainda"}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase">Onde você está</h2>
          </div>
          <p className="text-xl font-bold mt-3">
            {profile?.city
              ? `${profile.city}${profile.uf ? ` — ${profile.uf}` : ""}`
              : "Não informado"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Você aparece para todo o país. A cidade só ajuda quem prefere comprar perto.
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Seu cadastro</h2>
        <p className="text-sm text-muted-foreground mt-1">
          É por aqui que os comerciantes do seu nicho vão te encontrar.
        </p>

        <div className="mt-5 space-y-2">
          <Label>Nichos que você atende</Label>
          <div className="flex flex-wrap gap-1.5">
            {(allSegments || []).map((segment) => {
              const selected = segments.includes(segment.id);
              return (
                <button
                  key={segment.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(segment.id)}
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
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_6rem]">
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uf">Estado</Label>
            <select
              id="uf"
              value={uf}
              onChange={(event) => setUf(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            >
              <option value="">--</option>
              {UFS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          className="mt-5"
          disabled={save.isPending || !segments.length}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Salvando..." : "Salvar cadastro"}
        </Button>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 text-warning">
          <Star className="h-5 w-5" />
          <h2 className="font-semibold">Como os comerciantes te avaliam</h2>
        </div>
        {avaliacoes?.total ? (
          <>
            <p className="text-3xl font-bold mt-3">
              {num(avaliacoes.media, 1)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                de 5 · {avaliacoes.total} avaliação(ões)
              </span>
            </p>
            <ul className="mt-4 divide-y text-sm">
              {avaliacoes.reviews.slice(0, 5).map((review, index) => (
                <li key={index} className="py-2.5">
                  <p className="font-medium flex items-center gap-2">
                    <span className="text-warning">{"★".repeat(review.rating)}</span>
                    {review.autor}
                  </p>
                  {review.comment && (
                    <p className="text-muted-foreground mt-0.5">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-3">
            Ainda não há avaliações. Enquanto isso, o comerciante vê quantos pedidos você já
            concluiu e quantos orçamentos você responde — cumprir prazo e responder rápido é o que
            constrói sua reputação aqui.
          </p>
        )}
      </Card>
    </div>
  );
}
