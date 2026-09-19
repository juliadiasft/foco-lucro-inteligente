import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listProducts } from "@/lib/api/products.functions";
import {
  CANAIS,
  CONFIANCA_ROTULO,
  TAXAS_CONFERIDAS_EM,
  calcular,
  faixaDoPreco,
  precoParaMargem,
  type CanalId,
} from "@/lib/calculadora-margem";
import { brl, dataBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calculadora")({
  head: () => ({ meta: [{ title: "Calculadora de margem — Central do Comerciante" }] }),
  component: CalculadoraPage,
});

// "12,5" e "12.5" valem o mesmo; vazio é vazio, não zero.
const lerNumero = (texto: string): number | null => {
  const t = texto.trim().replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function Campo({
  id,
  rotulo,
  valor,
  aoMudar,
  dica,
  placeholder,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
      />
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

function CalculadoraPage() {
  const { data: produtos } = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const [produtoId, setProdutoId] = useState("");
  const [custo, setCusto] = useState("");
  const [preco, setPreco] = useState("");
  const [frete, setFrete] = useState("");
  const [outros, setOutros] = useState("");
  const [imposto, setImposto] = useState("");
  const [margemAlvo, setMargemAlvo] = useState("20");
  const [canalId, setCanalId] = useState<CanalId>("mercadolivre");
  // Taxa digitada por canal: trocar de canal não pode herdar a taxa do outro.
  const [taxas, setTaxas] = useState<Partial<Record<CanalId, { pct: string; fixo: string }>>>({});

  const escolherProduto = (id: string) => {
    setProdutoId(id);
    const p = produtos?.find((x) => x.id === id);
    if (!p) return;
    setCusto(String(p.costPrice).replace(".", ","));
    setPreco(String(p.salePrice).replace(".", ","));
  };

  const custoN = lerNumero(custo) ?? 0;
  const base = {
    custo: custoN,
    frete: lerNumero(frete) ?? 0,
    outros: lerNumero(outros) ?? 0,
    impostoPct: lerNumero(imposto) ?? 0,
  };
  const alvo = lerNumero(margemAlvo) ?? 0;
  const precoN = lerNumero(preco);

  const linhas = useMemo(
    () =>
      CANAIS.map((canal) => {
        const digitada = taxas[canal.id];
        const extra = {
          comissaoPct: digitada ? lerNumero(digitada.pct) : null,
          fixo: digitada ? lerNumero(digitada.fixo) : null,
        };
        const entrada = { ...base, ...extra };
        return {
          canal,
          resultado: precoN ? calcular(canal, { ...entrada, preco: precoN }) : null,
          minimo: custoN > 0 ? precoParaMargem(canal, entrada, alvo) : null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taxas, precoN, custo, frete, outros, imposto, alvo],
  );

  const atual = linhas.find((l) => l.canal.id === canalId)!;
  const canal = atual.canal;
  const faixa = faixaDoPreco(canal, precoN ?? 0);
  const digitada = taxas[canal.id];
  const editar = (campo: "pct" | "fixo", valor: string) =>
    setTaxas((t) => ({
      ...t,
      [canal.id]: { pct: t[canal.id]?.pct ?? "", fixo: t[canal.id]?.fixo ?? "", [campo]: valor },
    }));

  const r = atual.resultado;
  const negativo = r !== null && r.lucro < 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Calculadora de margem</h1>
        <p className="text-muted-foreground">
          Quanto sobra vendendo em marketplace — e por quanto vender para sobrar o que você quer.
        </p>
      </div>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="space-y-1">
          <Label htmlFor="produto">Puxar um produto seu (opcional)</Label>
          <select
            id="produto"
            value={produtoId}
            onChange={(e) => escolherProduto(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Digitar à mão</option>
            {produtos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="custo" rotulo="Quanto custa para você (R$)" valor={custo} aoMudar={setCusto} />
          <Campo
            id="preco"
            rotulo="Preço de venda no anúncio (R$)"
            valor={preco}
            aoMudar={setPreco}
          />
          <Campo
            id="frete"
            rotulo="Frete que sai do seu bolso (R$)"
            valor={frete}
            aoMudar={setFrete}
            dica="Só o que o canal não desconta do cliente."
            placeholder="0"
          />
          <Campo
            id="outros"
            rotulo="Embalagem e outros (R$)"
            valor={outros}
            aoMudar={setOutros}
            placeholder="0"
          />
          <Campo
            id="imposto"
            rotulo="Imposto sobre a venda (%)"
            valor={imposto}
            aoMudar={setImposto}
            dica="Simples, MEI… deixe vazio se não sabe."
            placeholder="0"
          />
          <Campo
            id="alvo"
            rotulo="Margem que você quer (%)"
            valor={margemAlvo}
            aoMudar={setMargemAlvo}
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Canal de venda">
        {CANAIS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={canalId === c.id}
            onClick={() => setCanalId(c.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium",
              canalId === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="pct"
            rotulo="Comissão (%)"
            valor={digitada?.pct ?? ""}
            aoMudar={(v) => editar("pct", v)}
            placeholder={String(faixa.comissaoPct).replace(".", ",")}
            dica="Vazio usa a tabela do canal para este preço."
          />
          <Campo
            id="fixo"
            rotulo="Taxa fixa por item (R$)"
            valor={digitada?.fixo ?? ""}
            aoMudar={(v) => editar("fixo", v)}
            placeholder={String(faixa.fixo).replace(".", ",")}
          />
        </div>

        {r ? (
          <div
            className={cn(
              "rounded-xl border p-4",
              negativo
                ? "border-destructive/40 bg-destructive/5"
                : "border-success/30 bg-success/5",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {negativo ? "Você perde por venda" : "Sobra por venda"}
            </p>
            <p
              className={cn(
                "mt-1 text-4xl font-bold tabular-nums",
                negativo ? "text-destructive" : "text-success",
              )}
            >
              {brl(r.lucro)}
            </p>
            <p className="text-sm text-muted-foreground">
              {r.margemPct !== null && `${r.margemPct.toLocaleString("pt-BR")}% do preço`}
              {r.margemSobreCustoPct !== null &&
                ` · ${r.margemSobreCustoPct.toLocaleString("pt-BR")}% sobre o custo`}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">
                Comissão ({r.comissaoPct.toLocaleString("pt-BR")}%)
              </dt>
              <dd className="text-right tabular-nums">− {brl(r.comissao)}</dd>
              <dt className="text-muted-foreground">Taxa fixa</dt>
              <dd className="text-right tabular-nums">− {brl(r.fixo)}</dd>
              {r.imposto > 0 && (
                <>
                  <dt className="text-muted-foreground">Imposto</dt>
                  <dd className="text-right tabular-nums">− {brl(r.imposto)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Custo, frete e embalagem</dt>
              <dd className="text-right tabular-nums">
                − {brl(base.custo + base.frete + base.outros)}
              </dd>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Preencha o custo e o preço de venda para ver quanto sobra.
          </p>
        )}

        {atual.minimo !== null ? (
          <p className="text-sm">
            Para sobrar <strong>{alvo.toLocaleString("pt-BR")}%</strong> no {canal.nome}, venda a
            partir de <strong className="tabular-nums">{brl(atual.minimo)}</strong>.
          </p>
        ) : custoN > 0 ? (
          <p className="text-sm text-muted-foreground">
            Com essas taxas nenhum preço entrega {alvo.toLocaleString("pt-BR")}% de margem.
          </p>
        ) : null}

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            {CONFIANCA_ROTULO[canal.confianca]} · taxas lidas em {dataBR(TAXAS_CONFERIDAS_EM)}
          </p>
          <p className="mt-1">{canal.nota}</p>
          {canal.fonte && (
            <a
              href={canal.fonte}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-primary underline"
            >
              Conferir na fonte <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </Card>

      {precoN ? (
        <Card className="overflow-hidden p-0">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">
            Em cada canal, a {brl(precoN)}
          </p>
          <div className="divide-y divide-border">
            {[...linhas]
              .sort((a, b) => (b.resultado?.lucro ?? 0) - (a.resultado?.lucro ?? 0))
              .map(({ canal: c, resultado }) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanalId(c.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/50"
                >
                  <span>
                    {c.nome}
                    {c.confianca !== "oficial" && (
                      <span className="ml-2 text-xs text-muted-foreground">confira a taxa</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      resultado && resultado.lucro < 0 && "text-destructive",
                    )}
                  >
                    {resultado ? `${brl(resultado.lucro)} · ${resultado.margemPct}%` : "—"}
                  </span>
                </button>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
