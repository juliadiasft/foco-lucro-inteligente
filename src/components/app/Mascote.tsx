import { cn } from "@/lib/utils";

// O mascote da Central. Poses recortadas em /mascote/*.webp (fundo transparente,
// então valem no tema claro e no escuro).
export type Pose =
  "aceno" | "joinha" | "andando" | "correndo" | "tablet" | "grafico" | "caixas" | "painel-correndo";

// Movimento:
//  - flutuar:   respira parado (padrão; vale para qualquer pose)
//  - comemorar: pula e alterna aceno ↔ joinha (usar em meta batida)
//  - andar:     balança de um lado a outro alternando andando ↔ correndo
//  - parado:    sem animação
export type Movimento = "flutuar" | "comemorar" | "andar" | "parado";

const PAR_DO_MOVIMENTO: Partial<Record<Movimento, [Pose, Pose]>> = {
  comemorar: ["aceno", "joinha"],
  andar: ["andando", "correndo"],
};

const CLASSE_DO_MOVIMENTO: Record<Movimento, string> = {
  flutuar: "mascote-flutuar",
  comemorar: "mascote-pular",
  andar: "mascote-andar",
  parado: "",
};

const src = (pose: Pose) => `/mascote/${pose}.webp`;

export function Mascote({
  pose = "aceno",
  movimento = "flutuar",
  className,
  alt = "Mascote da Central do Comerciante",
}: {
  pose?: Pose;
  movimento?: Movimento;
  className?: string;
  alt?: string;
}) {
  const par = PAR_DO_MOVIMENTO[movimento];
  const ciclo = movimento === "andar" ? "0.7s" : "1.4s";
  return (
    <div
      className={cn("relative inline-block", CLASSE_DO_MOVIMENTO[movimento], className)}
      style={{ ["--mascote-ciclo" as string]: ciclo }}
    >
      {par ? (
        <>
          <img
            src={src(par[0])}
            alt={alt}
            className="mascote-pose-a-some h-full w-auto select-none"
            draggable={false}
          />
          <img
            src={src(par[1])}
            alt=""
            aria-hidden="true"
            className="mascote-pose-b absolute inset-0 h-full w-auto select-none opacity-0"
            draggable={false}
          />
        </>
      ) : (
        <img src={src(pose)} alt={alt} className="h-full w-auto select-none" draggable={false} />
      )}
    </div>
  );
}
