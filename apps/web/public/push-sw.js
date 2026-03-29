self.addEventListener("push", (event) => {
  const payload = event.data
    ? event.data.json()
    : {
        body: "You have a new notification.",
        title: "Mangy",
        url: "/notifications",
      };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Mangy", {
      body: payload.body || "You have a new notification.",
      data: {
        url: payload.url || "/notifications",
      },
      tag: payload.tag || payload.notificationId || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/notifications",
    self.location.origin
  ).toString();

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      const existingClient = clients.find((client) => {
        return "focus" in client;
      });

      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
