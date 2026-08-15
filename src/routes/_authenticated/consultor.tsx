import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bot, Lightbulb, Send, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { askProfitAi, getProfitAnalysis, listAiHistory } from "@/lib/api/analysis.functions";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/consultor")({
  head: () => ({ meta: [{ title: "Consultor IA — Central do Comerciante" }] }),
  component: ConsultantPage,
});
function ConsultantPage() {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["profit-analysis"],
    queryFn: () => getProfitAnalysis(),
  });
  const { data: history = [] } = useQuery({
    queryKey: ["ai-history"],
    queryFn: () => listAiHistory(),
  });
  const ask = useMutation({
    mutationFn: () => askProfitAi({ data: { question } }),
    onSuccess: async (result) => {
      setAnswer(result.answer);
      setQuestion("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai-history"] }),
        queryClient.invalidateQueries({ queryKey: ["profit-analysis"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex gap-2">
            <Sparkles className="h-8 w-8 text-primary" /> Consultor de Lucro com IA
          </h1>
          <p className="text-muted-foreground">
            Análises e respostas baseadas nos dados reais da empresa.
          </p>
        </div>
        <Badge variant="outline">
          {data?.aiConfigured === false
            ? "Consultor em ativação"
            : data?.aiEnabled
              ? `${data.aiUsed || 0} de ${data.aiLimit || 0} perguntas no mês`
              : "Disponível no Profissional e Premium"}
        </Badge>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <Metric label="Faturamento — 30 dias" value={brl(data?.summary.revenue)} />
        <Metric label="Lucro estimado" value={brl(data?.summary.profit)} />
        <Metric label="Margem" value={`${num(data?.summary.margin, 1)}%`} />
        <Metric label="Ticket médio" value={brl(data?.summary.ticket)} />
      </div>
      <Card className="p-6 border-primary/30">
        <div className="flex gap-3">
          <Bot className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold">Pergunte à sua IA</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {data?.aiConfigured === false
                ? "O consultor está sendo ativado e ficará disponível em breve. As análises acima continuam funcionando normalmente."
                : data?.aiEnabled
                  ? "Ex.: “Quais preços devo revisar?” ou “Como aumentar meu lucro nesta semana?”"
                  : "Faça upgrade para o plano Profissional ou Premium para conversar com a IA."}
            </p>
            <Textarea
              rows={4}
              maxLength={1200}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Escreva sua pergunta..."
              disabled={data?.aiEnabled === false || data?.aiConfigured === false}
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-muted-foreground">
                Os dados enviados pertencem somente à empresa logada.
              </span>
              <Button
                disabled={
                  data?.aiEnabled === false ||
                  data?.aiConfigured === false ||
                  ask.isPending ||
                  question.trim().length < 3
                }
                onClick={() => ask.mutate()}
              >
                <Send className="h-4 w-4 mr-2" />
                {ask.isPending ? "Analisando..." : "Perguntar"}
              </Button>
            </div>
          </div>
        </div>
        {answer && (
          <div className="mt-5 p-4 rounded-lg bg-primary/5 border border-primary/20 whitespace-pre-wrap text-sm leading-relaxed">
            {answer}
          </div>
        )}
      </Card>
      <div>
        <h2 className="text-lg font-semibold flex gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-warning" /> Oportunidades automáticas
        </h2>
        {isLoading ? (
          <p>Calculando...</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data?.opportunities.map((item, index) => (
              <Card key={`${item.title}-${index}`} className="p-4">
                <div className="flex gap-3">
                  {item.level === "danger" || item.level === "warning" ? (
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-success shrink-0" />
                  )}
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    {item.impact != null && (
                      <p className="text-sm text-success font-semibold mt-2">
                        Economia por unidade cotada: {brl(item.impact)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {!!history.length && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Histórico recente</h2>
          <div className="space-y-3">
            {history.slice(0, 5).map((item) => (
              <Card key={item.id} className="p-4">
                <p className="font-medium text-sm">Você: {item.question}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">
                  IA: {item.answer}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}
