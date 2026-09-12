import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getConversation,
  listConversations,
  markConversationRead,
  sendMessage,
} from "@/lib/api/conversations.functions";
import { diaBR, horaBR, quandoNaLista } from "@/lib/format";
import type { ItemAberto } from "@/hooks/useItemAberto";
import { cn } from "@/lib/utils";

// Uma conversa aberta é atualizada com mais frequência que a lista. Sem
// WebSocket: consulta simples em intervalo, que é o suficiente para uma troca
// de mensagens comercial e não exige infraestrutura extra.
const LIST_INTERVAL = 30_000;
const THREAD_INTERVAL = 12_000;

// A conversa aberta vem da rota, e não de um estado daqui: é o que faz o gesto
// de voltar do celular fechar a conversa e mostrar a lista, como no WhatsApp.
// Ver src/hooks/useItemAberto.ts.
//
// No celular a conversa aberta ocupa a tela inteira entre o cabeçalho e a barra
// de baixo. Antes ela era um cartão de 26rem no meio da página: a lista de
// mensagens abria nas mais ANTIGAS — a resposta do fornecedor com o preço
// ficava fora da vista — e sobrava página rolando por fora da conversa.
export function ConversationsView({
  emptyHint,
  aberto: selected,
  abrir,
  fechar,
}: { emptyHint: string } & ItemAberto) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: LIST_INTERVAL,
  });

  const thread = useQuery({
    queryKey: ["conversation", selected],
    queryFn: () => getConversation({ data: { id: selected as string } }),
    enabled: Boolean(selected),
    refetchInterval: THREAD_INTERVAL,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markConversationRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });

  const quantas = thread.data?.messages.length;

  useEffect(() => {
    if (selected) markRead.mutate(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, quantas]);

  // Conversa se lê de baixo para cima: abrir e ver a mensagem mais recente é o
  // comportamento de todo aplicativo de mensagem. Vai ao fim do rolo, e não
  // até a última mensagem ficar visível — senão o respiro do rodapé some.
  useEffect(() => {
    const caixa = fim.current;
    if (quantas && caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [selected, quantas]);

  const send = useMutation({
    mutationFn: () =>
      sendMessage({ data: { conversationId: selected as string, body: draft.trim() } }),
    onSuccess: async () => {
      setDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversation", selected] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = conversations.data || [];
  const mensagens = thread.data?.messages || [];

  return (
    <div className="space-y-5">
      {/* Dentro da conversa, no celular, o título da tela sai da frente: quem
          está lendo já sabe onde está, e o nome de quem fala vem no topo dela. */}
      <div className={cn(selected && "hidden lg:block")}>
        <h1 className="text-xl font-bold md:text-3xl">Conversas</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tudo acontece aqui dentro. Não precisa sair para o WhatsApp.
        </p>
      </div>

      {!list.length ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium mt-3">Nenhuma conversa ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>
        </Card>
      ) : (
        <div className="lg:grid lg:gap-4 lg:grid-cols-[20rem_1fr]">
          {/* A lista: uma linha por conversa, com quem, quando e a última frase. */}
          <ul
            className={cn(
              "divide-y divide-border border-y border-border lg:max-h-[32rem] lg:overflow-y-auto lg:rounded-lg lg:border",
              selected && "hidden lg:block",
            )}
          >
            {list.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => abrir(conversation.id)}
                  className={cn(
                    "w-full p-3 text-left transition-colors hover:bg-muted/50",
                    selected === conversation.id && "bg-primary/10",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{conversation.counterpartName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {quandoNaLista(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted-foreground">
                      {conversation.lastBody || "Sem mensagens"}
                    </p>
                    {conversation.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                        {conversation.unread}
                      </span>
                    )}
                  </div>
                  {conversation.city && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {conversation.city}
                      {conversation.uf ? ` — ${conversation.uf}` : ""}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* No celular a conversa é a tela: presa entre o cabeçalho (4rem) e a
              barra de baixo. No computador volta a ser um cartão ao lado da
              lista. */}
          <div
            className={cn(
              "flex flex-col bg-background",
              selected
                ? "fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] top-16 z-20 lg:static lg:rounded-lg lg:border lg:border-border"
                : "hidden lg:flex lg:rounded-lg lg:border lg:border-border",
            )}
          >
            {!selected ? (
              <div className="grid flex-1 place-items-center p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Escolha uma conversa para ver as mensagens.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 border-b border-border bg-card px-2 py-2.5 lg:px-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Voltar"
                    onClick={fechar}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate font-semibold leading-tight">
                      {thread.data?.counterpartName}
                    </p>
                    {thread.data?.city && (
                      <p className="text-xs text-muted-foreground">
                        {thread.data.city}
                        {thread.data.uf ? ` — ${thread.data.uf}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div ref={fim} className="flex-1 space-y-2 overflow-y-auto p-4 lg:max-h-[26rem]">
                  {mensagens.map((message, indice) => {
                    const anterior = mensagens[indice - 1];
                    const dia = diaBR(message.createdAt);
                    const novoDia = !anterior || diaBR(anterior.createdAt) !== dia;
                    return (
                      <div key={message.id}>
                        {novoDia && (
                          <p className="py-2 text-center text-xs font-medium text-muted-foreground">
                            {dia}
                          </p>
                        )}
                        <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                              message.mine
                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                : "rounded-bl-sm bg-muted text-foreground",
                            )}
                          >
                            {!message.mine && message.senderName && (
                              <p className="text-xs font-semibold text-primary">
                                {message.senderName}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                            <p
                              className={cn(
                                "mt-0.5 text-right text-[11px]",
                                message.mine
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground",
                              )}
                            >
                              {horaBR(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-end gap-2 border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:p-3">
                  <Textarea
                    rows={1}
                    placeholder="Escreva sua mensagem"
                    className="max-h-32 min-h-11 resize-none rounded-2xl"
                    value={draft}
                    maxLength={4000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && draft.trim()) {
                        event.preventDefault();
                        send.mutate();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-full"
                    aria-label="Enviar mensagem"
                    disabled={send.isPending || !draft.trim()}
                    onClick={() => send.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
