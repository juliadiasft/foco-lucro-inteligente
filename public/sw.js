self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Central do Comerciante", body: event.data?.text() || "Novo alerta" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Central do Comerciante", {
      body: data.body || "Encontramos uma nova oportunidade para o seu comércio.",
      // Sem ícone, o celular mostra o do navegador, e a notificação parece
      // vir do Chrome e não da Central.
      icon: "/icones/icone-192.png",
      tag: data.tag || "central-alert",
      renotify: true,
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin)
    .href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then(() => existing.navigate(targetUrl));
      return clients.openWindow(targetUrl);
    }),
  );
});
