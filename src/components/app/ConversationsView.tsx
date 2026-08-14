import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
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
import { dataHoraBR } from "@/lib/format";
import { cn } from "@/lib/utils";

// Uma conversa aberta é atualizada com mais frequência que a lista. Sem
// WebSocket: consulta simples em intervalo, que é o suficiente para uma troca
// de mensagens comercial e não exige infraestrutura extra.
const LIST_INTERVAL = 30_000;
const THREAD_INTERVAL = 12_000;

export function ConversationsView({ emptyHint }: { emptyHint: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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

  useEffect(() => {
    if (selected) markRead.mutate(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, thread.data?.messages.length]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Conversas</h1>
        <p className="text-muted-foreground mt-1">
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
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Card className={cn("p-2 overflow-hidden", selected && "hidden lg:block")}>
            <ul className="divide-y max-h-[32rem] overflow-y-auto">
              {list.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(conversation.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors hover:bg-muted",
                      selected === conversation.id && "bg-primary/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{conversation.counterpartName}</span>
                      {conversation.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                          {conversation.unread}
                        </span>
                      )}
                    </div>
                    {conversation.city && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {conversation.city}
                        {conversation.uf ? ` — ${conversation.uf}` : ""}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conversation.lastBody || "Sem mensagens"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className={cn("flex flex-col", !selected && "hidden lg:flex")}>
            {!selected ? (
              <div className="flex-1 grid place-items-center p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Escolha uma conversa para ver as mensagens.
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-border p-4 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Voltar"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <p className="font-semibold">{thread.data?.counterpartName}</p>
                    {thread.data?.city && (
                      <p className="text-xs text-muted-foreground">
                        {thread.data.city}
                        {thread.data.uf ? ` — ${thread.data.uf}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[26rem]">
                  {(thread.data?.messages || []).map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex", message.mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          message.mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[11px]",
                            message.mine ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}
                        >
                          {message.senderName ? `${message.senderName} · ` : ""}
                          {dataHoraBR(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border p-3 flex items-end gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Escreva sua mensagem"
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
                    aria-label="Enviar mensagem"
                    disabled={send.isPending || !draft.trim()}
                    onClick={() => send.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
