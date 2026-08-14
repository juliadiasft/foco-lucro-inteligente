import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCompany, updateCompany } from "@/lib/api/company.functions";
import {
  getPushConfiguration,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/api/notifications.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Central do Comerciante" }] }),
  component: SettingsPage,
});

const initial = {
  name: "",
  cnpj: "",
  businessType: "",
  phone: "",
  monthlyRevenueGoal: "",
  expectedAverageTicket: "",
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["company"], queryFn: () => getCompany() });
  const [form, setForm] = useState(initial);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const { data: pushConfiguration, refetch: refetchPush } = useQuery({
    queryKey: ["push-configuration"],
    queryFn: () => getPushConfiguration(),
  });
  useEffect(() => {
    if (typeof window !== "undefined")
      setPushPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  useEffect(() => {
    if (data)
      setForm({
        name: data.name,
        cnpj: data.cnpj || "",
        businessType: data.businessType || "",
        phone: data.phone || "",
        monthlyRevenueGoal: String(data.monthlyRevenueGoal || ""),
        expectedAverageTicket: String(data.expectedAverageTicket || ""),
      });
  }, [data]);
  const save = useMutation({
    mutationFn: () =>
      updateCompany({
        data: {
          name: form.name,
          cnpj: form.cnpj,
          businessType: form.businessType,
          phone: form.phone,
          monthlyRevenueGoal: Number(form.monthlyRevenueGoal) || 0,
          expectedAverageTicket: Number(form.expectedAverageTicket) || 0,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Configurações salvas!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const enablePush = useMutation({
    mutationFn: async () => {
      if (!pushConfiguration?.configured || !pushConfiguration.publicKey)
        throw new Error("Notificações no celular ainda não foram ativadas pelo sistema");
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error("Este navegador não aceita notificações. Tente pelo Chrome no celular.");
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted")
        throw new Error("Você precisa permitir as notificações no navegador");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(pushConfiguration.publicKey),
        }));
      await savePushSubscription({ data: subscription.toJSON() as PushSubscriptionJSON });
    },
    onSuccess: async () => {
      await refetchPush();
      toast.success("Alertas ativados neste aparelho!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const disablePush = useMutation({
    mutationFn: async () => {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      await removePushSubscription({ data: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
    },
    onSuccess: async () => {
      await refetchPush();
      toast.success("Alertas desativados neste aparelho.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Dados e metas da empresa</p>
      </div>
      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Nome da empresa *">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          {data?.registrationDocument && (
            <Field label="Documento usado no cadastro">
              <Input readOnly value={data.registrationDocument} className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Protegido e vinculado ao teste grátis. Não pode ser alterado.
              </p>
            </Field>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CNPJ">
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Tipo de negócio">
            <Input
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Meta mensal (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyRevenueGoal}
                onChange={(e) => setForm({ ...form, monthlyRevenueGoal: e.target.value })}
              />
            </Field>
            <Field label="Ticket desejado (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.expectedAverageTicket}
                onChange={(e) => setForm({ ...form, expectedAverageTicket: e.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </Card>
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Alertas no celular</h2>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Receba oportunidades de fornecedores mesmo quando a Central estiver fechada. A
                comparação automática não consome créditos da IA.
              </p>
              {pushPermission === "denied" && (
                <p className="mt-2 text-xs text-destructive">
                  As notificações estão bloqueadas no navegador. Libere-as nas configurações do
                  site.
                </p>
              )}
              {pushConfiguration && !pushConfiguration.configured && (
                <p className="mt-2 text-xs text-warning">
                  O recurso está pronto, aguardando a ativação técnica das notificações.
                </p>
              )}
              {(pushConfiguration?.activeDevices || 0) > 0 && (
                <p className="mt-2 text-xs font-medium text-success">
                  Ativo em {pushConfiguration?.activeDevices} aparelho(s).
                </p>
              )}
            </div>
          </div>
          {(pushConfiguration?.activeDevices || 0) > 0 ? (
            <Button
              variant="outline"
              disabled={disablePush.isPending}
              onClick={() => disablePush.mutate()}
            >
              <BellOff className="h-4 w-4" /> Desativar neste aparelho
            </Button>
          ) : (
            <Button
              disabled={
                enablePush.isPending ||
                pushPermission === "unsupported" ||
                pushPermission === "denied" ||
                !pushConfiguration?.configured
              }
              onClick={() => enablePush.mutate()}
            >
              <Bell className="h-4 w-4" /> Ativar alertas
            </Button>
          )}
        </div>
      </Card>
      <Card className="p-4 border-warning/40 bg-warning/10">
        <h2 className="font-semibold text-sm mb-1">Aviso fiscal</h2>
        <p className="text-xs text-muted-foreground">
          Este sistema controla vendas, estoque e lucro, mas não substitui a emissão de NF-e ou
          NFC-e em emissor autorizado.
        </p>
      </Card>
    </div>
  );
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
