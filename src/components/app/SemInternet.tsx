import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { useOnline } from "@/hooks/useConexao";
import { mensagemSemInternet, ultimoCarregamento } from "@/lib/conexao";
import { horaBR } from "@/lib/format";

// X06: faixa no topo quando a conexão cai. A hora é congelada no momento em que
// caiu, para não parecer que os dados estão sendo atualizados.
export function SemInternet() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [hora, setHora] = useState<string | null>(null);

  useEffect(() => {
    if (online) return;
    const ultimo = ultimoCarregamento(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.state),
    );
    setHora(ultimo ? horaBR(new Date(ultimo)) : null);
  }, [online, queryClient]);

  if (online) return null;
  return (
    <div
      role="status"
      className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 md:mx-8"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div>
        <p className="font-semibold">Sem internet</p>
        <p className="text-sm text-muted-foreground">{mensagemSemInternet(hora)}</p>
      </div>
    </div>
  );
}
