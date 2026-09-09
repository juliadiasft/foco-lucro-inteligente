import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Faz um bloco surgir quando ele entra na tela.
//
// Sem isto a página inteira nasce pronta de uma vez, e rolar não tem ritmo
// nenhum — foi a queixa da Julia de que estava "muito crua".
//
// Duas regras que não dão para negociar:
//
//   O conteúdo nasce visível para quem não tem JavaScript e para o robô do
//   Google. A animação só entra depois que o componente monta. Página que
//   depende de script para mostrar texto é página que às vezes não mostra nada.
//
//   Quem pede menos movimento no sistema operacional não recebe movimento. Não
//   é preferência estética: animação disparada por rolagem provoca enjoo e
//   tontura em quem tem sensibilidade vestibular.
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const referencia = useRef<HTMLDivElement>(null);
  const [animar, setAnimar] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const menosMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (menosMovimento) return;

    // Só a partir daqui o bloco passa a começar escondido: antes do JS rodar
    // ele já estava na tela, e assim continua se algo der errado.
    setAnimar(true);

    const alvo = referencia.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setVisivel(true);
            observador.disconnect();
          }
        }
      },
      // Dispara um pouco antes de encostar na borda, para o bloco já chegar
      // aparecendo em vez de aparecer depois de parado.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={referencia}
      style={visivel ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        animar && "transition-all duration-700 ease-out",
        animar && !visivel && "opacity-0 translate-y-6",
        animar && visivel && "opacity-100 translate-y-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
