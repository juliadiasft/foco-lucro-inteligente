// Premiação por RESULTADO (etapa 6).
//
// A pessoa sobe de degrau pelo valor que a Central de fato movimentou para ela:
//   - comerciante: valor comprado em pedidos aceitos ou concluídos;
//   - fornecedor:  valor vendido nesses mesmos pedidos.
// Nunca por visita, uso ou tempo no app — a mesma regra dos avisos: a Central
// não pede que ninguém "dê uma olhada".
//
// O primeiro degrau, R$ 10 mil, é o do mascotinho entregue em casa. Abaixo dele
// só existe a barra de progresso: sem prêmio, sem confete.

export type Lado = "comerciante" | "fornecedor";

export type Degrau = {
  /** Valor acumulado, em reais, que abre o degrau. */
  valor: number;
  rotulo: string;
  /** Só o primeiro degrau tem entrega física combinada. */
  premioFisico: boolean;
};

export const DEGRAUS: readonly Degrau[] = [
  { valor: 10_000, rotulo: "R$ 10 mil", premioFisico: true },
  { valor: 50_000, rotulo: "R$ 50 mil", premioFisico: false },
  { valor: 100_000, rotulo: "R$ 100 mil", premioFisico: false },
  { valor: 250_000, rotulo: "R$ 250 mil", premioFisico: false },
  { valor: 500_000, rotulo: "R$ 500 mil", premioFisico: false },
  { valor: 1_000_000, rotulo: "R$ 1 milhão", premioFisico: false },
];

export const COMO_CONTA: Record<Lado, string> = {
  comerciante: "Conta o valor dos seus pedidos aceitos ou concluídos pela Central.",
  fornecedor: "Conta o valor vendido em pedidos aceitos ou concluídos pela Central.",
};

export type EstadoDaPremiacao = {
  total: number;
  /** Degraus já alcançados, do menor para o maior. */
  conquistados: Degrau[];
  /** O maior já alcançado. */
  atual: Degrau | null;
  /** O próximo a alcançar; `null` no topo. */
  proximo: Degrau | null;
  /** Quanto falta em reais para o próximo. */
  falta: number;
  /** 0–100, da base do degrau atual até o próximo. */
  progressoPct: number;
};

export function estadoDaPremiacao(total: number): EstadoDaPremiacao {
  const valor = Number.isFinite(total) && total > 0 ? total : 0;
  const conquistados = DEGRAUS.filter((d) => valor >= d.valor);
  const atual = conquistados.length ? conquistados[conquistados.length - 1] : null;
  const proximo = DEGRAUS.find((d) => valor < d.valor) ?? null;
  const base = atual?.valor ?? 0;
  const progressoPct = proximo
    ? Math.min(100, Math.max(0, Math.floor(((valor - base) / (proximo.valor - base)) * 100)))
    : 100;
  return {
    total: valor,
    conquistados,
    atual,
    proximo,
    falta: proximo ? Math.round((proximo.valor - valor) * 100) / 100 : 0,
    progressoPct,
  };
}

/**
 * Degraus que passaram a valer agora e ainda não foram registrados. Serve para
 * gravar a conquista uma vez só: pedido cancelado depois não a tira, porque o
 * registro é a prova, não o total de hoje.
 */
export function degrausNovos(total: number, jaRegistrados: readonly number[]): Degrau[] {
  return estadoDaPremiacao(total).conquistados.filter((d) => !jaRegistrados.includes(d.valor));
}
