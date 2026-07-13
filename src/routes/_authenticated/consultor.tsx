import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingDown, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/consultor")({
  head: () => ({ meta: [{ title: "Consultor IA — Central do Comerciante" }] }),
  component: ConsultorPage,
});

function ConsultorPage() {
  const { data } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const [produtos, vendas] = await Promise.all([
        supabase.from("produtos").select("*").eq("ativo", true),
        supabase.from("vendas").select("*").gte("data_venda", new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);
      const pp = produtos.data ?? [];
      const vv = vendas.data ?? [];

      const insights: { tipo: "critico" | "atencao" | "oportunidade"; titulo: string; descricao: string; impacto?: string }[] = [];

      // Margens baixas
      const baixaMargem = pp.filter((p) => {
        const m = Number(p.preco_venda) > 0 ? ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_venda)) * 100 : 0;
        return m < 15 && Number(p.preco_venda) > 0;
      });
      if (baixaMargem.length > 0) {
        insights.push({
          tipo: "critico",
          titulo: `${baixaMargem.length} produto(s) com margem crítica`,
          descricao: `Produtos vendidos com margem abaixo de 15% podem estar dando prejuízo depois de impostos e custos operacionais. Considere reajustar: ${baixaMargem.slice(0, 3).map((p) => p.nome).join(", ")}.`,
          impacto: "Alto",
        });
      }

      // Estoque parado
      const estoqueParado = pp.filter((p) => Number(p.estoque_atual) > Number(p.estoque_minimo) * 5);
      if (estoqueParado.length > 0) {
        const capital = estoqueParado.reduce((s, p) => s + Number(p.preco_custo) * Number(p.estoque_atual), 0);
        insights.push({
          tipo: "atencao",
          titulo: "Capital preso em estoque parado",
          descricao: `Você tem ${brl(capital)} imobilizados em produtos com estoque muito acima do mínimo. Faça promoções para girar esse capital.`,
          impacto: brl(capital),
        });
      }

      // Sem vendas
      if (vv.length === 0) {
        insights.push({
          tipo: "atencao",
          titulo: "Nenhuma venda registrada nos últimos 30 dias",
          descricao: "Comece a registrar suas vendas para desbloquear análises inteligentes de lucro, produtos mais rentáveis e tendências.",
        });
      }

      // Oportunidade — margem alta
      const altaMargem = pp
        .map((p) => ({ p, m: Number(p.preco_venda) > 0 ? ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_venda)) * 100 : 0 }))
        .filter((x) => x.m >= 40)
        .sort((a, b) => b.m - a.m)
        .slice(0, 3);
      if (altaMargem.length > 0) {
        insights.push({
          tipo: "oportunidade",
          titulo: "Produtos-estrela: foque nestes",
          descricao: `Estes produtos têm as maiores margens do seu catálogo. Destaque-os, treine sua equipe para oferecê-los primeiro: ${altaMargem.map((x) => `${x.p.nome} (${num(x.m, 0)}%)`).join(", ")}.`,
        });
      }

      if (insights.length === 0) {
        insights.push({
          tipo: "oportunidade",
          titulo: "Tudo em ordem por aqui!",
          descricao: "Cadastre mais produtos e registre suas vendas para o consultor IA gerar recomendações personalizadas.",
        });
      }

      return insights;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-hero text-primary-foreground flex items-center justify-center">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Consultor de Lucro IA</h1>
          <p className="text-muted-foreground">Recomendações inteligentes baseadas nos seus dados</p>
        </div>
      </div>

      <div className="space-y-4">
        {(data ?? []).map((ins, i) => {
          const cfg = {
            critico: { icon: AlertTriangle, cls: "border-destructive/40 bg-destructive/5", iconCls: "text-destructive" },
            atencao: { icon: TrendingDown, cls: "border-warning/40 bg-warning/5", iconCls: "text-warning" },
            oportunidade: { icon: Lightbulb, cls: "border-success/40 bg-success/5", iconCls: "text-success" },
          }[ins.tipo];
          const Icon = cfg.icon;
          return (
            <Card key={i} className={`p-6 border-2 ${cfg.cls}`}>
              <div className="flex gap-4">
                <div className={`shrink-0 ${cfg.iconCls}`}><Icon className="h-6 w-6" /></div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-lg">{ins.titulo}</h3>
                    {ins.impacto && <span className="text-xs bg-background border border-border px-2 py-1 rounded-md whitespace-nowrap">Impacto: {ins.impacto}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{ins.descricao}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
