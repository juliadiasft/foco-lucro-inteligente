import { Link } from "@tanstack/react-router";
import { CircleCheck, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { diaPorExtenso, emDias, type EstadoDaCota } from "@/lib/cota-ia";
import { brl } from "@/lib/format";
import type { ProximoPlano } from "@/lib/limite-produtos";

// X02: a cota de perguntas acabou. Diz quando volta, deixa claro que o resto
// segue funcionando (a cota limita a conversa, nunca o valor) e só depois
// oferece o plano acima — se ainda houver um.
export function CotaEsgotada({
  cota,
  proximo,
  ancora,
  continuaRodando,
}: {
  cota: EstadoDaCota;
  proximo: ProximoPlano | null;
  /** id da seção da mesma página com o que segue calculado. */
  ancora: string;
  continuaRodando: string;
}) {
  return (
    <div className="space-y-3">
      <Card className="border-warning/50 p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Suas {cota.limite} perguntas do mês acabaram</p>
            <p className="text-sm text-muted-foreground">
              Renovam em {diaPorExtenso(cota.renovaEm)}, {emDias(cota.diasParaRenovar)}.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-success/40 p-4">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div className="flex-1">
            <p className="font-semibold">O que continua rodando sozinho</p>
            <p className="mt-1 text-sm text-muted-foreground">{continuaRodando}</p>
            <Button asChild variant="secondary" className="mt-3 w-full">
              <a href={`#${ancora}`}>Ver agora</a>
            </Button>
          </div>
        </div>
      </Card>

      {proximo && (
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-semibold">
                {proximo.plano.charAt(0).toUpperCase() + proximo.plano.slice(1)} ·{" "}
                {proximo.perguntasIA} perguntas
              </p>
              <p className="text-xs text-muted-foreground">
                {proximo.produtos === null
                  ? "produtos ilimitados"
                  : `até ${proximo.produtos} produtos`}{" "}
                · {proximo.usuarios} usuários
              </p>
            </div>
            <p className="font-bold whitespace-nowrap tabular-nums">{brl(proximo.preco)}</p>
          </div>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/assinatura">Comparar planos</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
