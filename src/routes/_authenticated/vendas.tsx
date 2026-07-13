import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { brl, dataHoraBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [{ title: "Vendas — Central do Comerciante" }] }),
  component: VendasPage,
});

function VendasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendas").select("*").order("data_venda", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Vendas</h1>
        <p className="text-muted-foreground">Histórico das últimas vendas</p>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 font-medium">Nenhuma venda registrada</p>
            <p className="text-sm text-muted-foreground">O módulo de PDV completo estará disponível em breve.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Data</th><th className="p-3">Cliente</th><th className="p-3">Pagamento</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Lucro</th></tr>
              </thead>
              <tbody>
                {data!.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="p-3">{dataHoraBR(v.data_venda)}</td>
                    <td className="p-3">{v.cliente_nome || "—"}</td>
                    <td className="p-3 capitalize">{v.forma_pagamento}</td>
                    <td className="p-3 text-right font-medium">{brl(Number(v.total))}</td>
                    <td className="p-3 text-right text-success font-medium">{brl(Number(v.lucro))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
