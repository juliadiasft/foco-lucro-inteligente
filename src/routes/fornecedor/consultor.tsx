import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bot, Info, Send, TrendingDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  askSupplierAi,
  getSupplierInsights,
  listSupplierAiHistory,
} from "@/lib/api/supplier-analysis.functions";
import { baseUnitShort } from "@/lib/catalog";
import { brl, dataHoraBR, num } from "@/lib/format";

export const Route = createFileRoute("/fornecedor/consultor")({
  head: () => ({ meta: [{ title: "Consultor de Vendas — Central do Comerciante" }] }),
  component: SupplierAdvisor,
});

const sugestoes = [
  "Por que não estou recebendo pedidos?",
  "Quais itens devo baixar o preço para vender mais?",
  "Como está meu preço em relação ao mercado?",
  "O que fazer para fechar mais orçamentos?",
];

const alertaIcones = { danger: AlertTriangle, warning: TrendingDown, info: Info } as const;
const alertaEstilos = {
  danger: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-primary/30 bg-primary/5",
} as const;

function SupplierAdvisor() {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");

  const { data } = useQuery({
    queryKey: ["supplier-insights"],
    queryFn: () => getSupplierInsights(),
  });
  const { data: historico } = useQuery({
    queryKey: ["supplier-ai-history"],
    queryFn: () => listSupplierAiHistory(),
  });

  const ask = useMutation({
    mutationFn: () => askSupplierAi({ data: { question } }),
    onSuccess: async () => {
      setQuestion("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supplier-ai-history"] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-insights"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const semPlano = data?.aiEnabled === false;
  const semChave = data?.aiConfigured === false;
  const bloqueado = semPlano || semChave;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Consultor de Vendas</h1>
          <p className="text-muted-foreground mt-1">
            Análises e respostas com base nos seus números e na sua posição de mercado.
          </p>
        </div>
        <Badge variant="outline">
          {semChave
            ? "Consultor em ativação"
            : data?.aiEnabled
              ? `${data.aiUsed} de ${data.aiLimit} perguntas no mês`
              : "Disponível no Profissional e Premium"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Faturamento no mês</p>
          <p className="text-2xl font-bold mt-2">{brl(data?.vendas.mes)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {num(data?.vendas.pedidos)} pedido(s) no total
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Ticket médio</p>
          <p className="text-2xl font-bold mt-2">{brl(data?.vendas.ticket)}</p>
          <p className="text-xs text-muted-foreground mt-1">Por pedido fechado</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Orçamentos</p>
          <p className="text-2xl font-bold mt-2">
            {num(data?.orcamentos.ganhos)} / {num(data?.orcamentos.total)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {num(data?.orcamentos.aguardando)} esperando você
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-primary">Itens no catálogo</p>
          <p className="text-2xl font-bold mt-2">{num(data?.itens)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.vitrinePublicada ? "Vitrine publicada" : "Vitrine oculta"}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">O que precisa da sua atenção</h2>
        <ul className="mt-4 space-y-3">
          {(data?.alertas || []).map((alerta, index) => {
            const Icon = alertaIcones[alerta.nivel];
            return (
              <li
                key={index}
                className={`rounded-lg border p-4 flex gap-3 ${alertaEstilos[alerta.nivel]}`}
              >
                <Icon className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{alerta.titulo}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{alerta.texto}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {(data?.acimaDoMercado.length || 0) > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold">Seu preço comparado ao mercado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mostramos a média e o menor preço praticados na Central para o mesmo produto. Não
            informamos quem são os outros fornecedores.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">Produto</th>
                  <th className="py-2 pr-4 font-medium text-right">Seu preço</th>
                  <th className="py-2 pr-4 font-medium text-right">Média</th>
                  <th className="py-2 pr-4 font-medium text-right">Menor</th>
                  <th className="py-2 font-medium text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {data?.acimaDoMercado.map((item, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {item.nome}
                      {item.marca ? ` — ${item.marca}` : ""}
                      <span className="block text-xs text-muted-foreground">
                        {item.fornecedores} fornecedor(es) oferecem
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-medium">
                      {brl(item.meuPreco)}/{baseUnitShort[item.baseUnit]}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {brl(item.mediaMercado)}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {item.menorMercado === null ? "—" : brl(item.menorMercado)}
                    </td>
                    <td className="py-2 text-right text-destructive font-medium">
                      +{num(item.diferencaPercentual, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex gap-3">
          <Bot className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold">Pergunte ao seu consultor</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {semChave
                ? "O consultor está sendo ativado e ficará disponível em breve. As análises acima continuam funcionando normalmente."
                : semPlano
                  ? "Assine o plano Profissional ou Premium para conversar com o consultor."
                  : "Ele conhece seu catálogo, seus orçamentos, suas vendas e sua posição de preço."}
            </p>
            {!bloqueado && (
              <div className="flex flex-wrap gap-2 mb-3">
                {sugestoes.map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => setQuestion(sugestao)}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    {sugestao}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              rows={4}
              maxLength={1200}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Escreva sua pergunta..."
              disabled={bloqueado}
            />
            <div className="flex flex-wrap justify-between items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">
                Enviamos apenas dados da sua empresa e a média do mercado, nunca o preço
                identificado de outro fornecedor.
              </span>
              <Button
                disabled={bloqueado || ask.isPending || question.trim().length < 3}
                onClick={() => ask.mutate()}
              >
                <Send className="h-4 w-4 mr-2" />
                {ask.isPending ? "Analisando..." : "Perguntar"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {(historico?.length || 0) > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold">Respostas anteriores</h2>
          <div className="mt-4 space-y-4">
            {historico?.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-4">
                <p className="font-medium text-sm">{item.question}</p>
                <p className="text-xs text-muted-foreground">{dataHoraBR(item.createdAt)}</p>
                <p className="text-sm mt-2 whitespace-pre-wrap">{item.answer}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
