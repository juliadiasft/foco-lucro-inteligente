import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CircleDollarSign, MessageCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listNotifications, markNotificationRead } from "@/lib/api/notifications.functions";
import { dataHoraBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { planIncludes } from "@/lib/plans";

type NotificationItem = Awaited<ReturnType<typeof listNotifications>>[number];

// O WhatsApp da Central, o mesmo do botão de ajuda.
const WHATSAPP = "5519994171970";

/** A pergunta que vai pronta para o consultor, já sobre esta oferta. */
function perguntaSobre(aviso: NotificationItem) {
  return `Sobre o aviso "${aviso.title}": ${aviso.message} — vale a pena trocar de fornecedor nesse caso? O que eu devo conferir antes?`;
}

/** O link do WhatsApp com o aviso inteiro já escrito. */
function linkDeAjuda(aviso: NotificationItem) {
  const texto = `Oi! Recebi este aviso na Central:\n\n${aviso.title}\n${aviso.message}\n\nQueria entender melhor.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

export function NotificationCenter() {
  const { user } = useAuth();
  // Quem não tem IA no plano não vê o botão de perguntar. Mostrar e barrar
  // depois seria pior: a pessoa clica, é recusada, e aprende a desconfiar do
  // resto da tela.
  const temIa = Boolean(user?.plan && planIncludes(user.plan, "consultorIa"));
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 60_000,
  });
  const unread = notifications.filter(
    (notification: NotificationItem) => !notification.read,
  ).length;
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Abrir alertas">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Alertas inteligentes</p>
              <p className="text-xs text-muted-foreground">
                Oportunidades encontradas automaticamente
              </p>
            </div>
            {unread > 0 && <Badge variant="destructive">{unread} novo(s)</Badge>}
          </div>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {!notifications.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Nenhum alerta por enquanto.
            </div>
          ) : (
            notifications.map((notification: NotificationItem) => (
              <div
                key={notification.id}
                className={cn("border-b p-4 last:border-b-0", !notification.read && "bg-primary/5")}
              >
                <div className="flex gap-3">
                  <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{notification.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {notification.message}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {dataHoraBR(notification.createdAt)}
                      </span>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markRead.mutate(notification.id)}
                          >
                            <Check className="h-3.5 w-3.5" /> Lido
                          </Button>
                        )}
                        {/* Perguntar sobre ESTA oferta, e não abrir o consultor
                            em branco: quem acabou de ler "ração 15% mais barata"
                            tem uma dúvida sobre aquilo, não sobre o negócio em
                            geral. A pergunta vai pronta na URL.

                            Só aparece para quem tem IA no plano. No Essencial o
                            botão sumiria sem explicação — por isso o de falar
                            com a Julia fica para todo mundo. */}
                        {temIa && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            onClick={() => markRead.mutate(notification.id)}
                          >
                            <Link
                              to="/consultor"
                              search={{ pergunta: perguntaSobre(notification) }}
                            >
                              <Sparkles className="h-3.5 w-3.5" /> Perguntar
                            </Link>
                          </Button>
                        )}
                        {/* O WhatsApp leva o aviso inteiro junto. A Julia recebe
                            o produto, o fornecedor e a economia já escritos, em
                            vez de "oi, sobre aquele aviso ali". */}
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          onClick={() => markRead.mutate(notification.id)}
                        >
                          <a
                            href={linkDeAjuda(notification)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Falar
                          </a>
                        </Button>
                        {notification.actionUrl === "/fornecedores" && (
                          <Button
                            asChild
                            size="sm"
                            onClick={() => markRead.mutate(notification.id)}
                          >
                            <Link to="/fornecedores">Ver comparação</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
