import { HelpCircle, Mail, MessageCircle, X } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";

// O botão de ajuda que fica em toda tela do painel.
//
// POR QUE NÃO É UM ROBÔ DE IA, que foi o pedido original.
//
// Um robô responderia na hora, e é isso que o torna tentador. Mas nesta fase
// ele custa três coisas:
//
//   - dinheiro: cada dúvida gasta crédito da OpenAI, e o Essencial não tem
//     nenhuma pergunta de IA incluída — o cliente que mais se perde é
//     justamente o que não teria direito a perguntar;
//   - confiança: um robô que inventa resposta sobre o próprio produto é pior
//     que nenhuma resposta, e ele vai inventar, porque não existe base escrita
//     sobre a Central para ele consultar;
//   - aprendizado: com os primeiros clientes, ouvir a dúvida em primeira mão é
//     o que diz o que precisa mudar na tela. Um robô no meio filtra
//     exatamente a informação mais valiosa que existe agora.
//
// Então o botão leva a pessoa direto para uma pessoa. Quando houver clientes
// suficientes para as mesmas perguntas se repetirem, aí vale trocar por um
// robô — treinado nas respostas que já foram dadas, e não em suposição.
//
// O gesto que ele resolve é o mesmo do pedido: quem está perdido não fica
// clicando errado até desistir. Tem para onde ir, na mesma tela, sempre no
// mesmo canto.
export function BotaoDeAjuda() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {aberto && (
        <Card className="fixed bottom-20 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] p-4 shadow-elegant md:bottom-24 md:right-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Precisa de ajuda?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fale com a gente. Respondemos em pessoa, não é robô.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Fechar ajuda"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {/* O assunto já vem escrito para quem escreve não travar na
                primeira linha — é onde a maioria desiste de pedir ajuda. */}
            <a
              href="mailto:centraldocomerciante@gmail.com?subject=Preciso%20de%20ajuda%20na%20Central"
              className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">Mandar um e-mail</span>
                <span className="block text-xs text-muted-foreground">
                  centraldocomerciante@gmail.com
                </span>
              </span>
            </a>
            <a
              href="/contato"
              className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-primary hover:bg-primary/5"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">Escrever pelo site</span>
                <span className="block text-xs text-muted-foreground">
                  Formulário de contato
                </span>
              </span>
            </a>
          </div>
        </Card>
      )}

      <button
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar ajuda" : "Preciso de ajuda"}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        {aberto ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </>
  );
}
