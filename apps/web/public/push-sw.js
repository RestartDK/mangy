/** @type {(value: unknown) => value is Record<string, unknown>} */
const isRecord = (value) => typeof value === "object" && value !== null;

/** @type {(value: unknown) => ServiceWorkerPushPayload} */
const parsePayload = (value) => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    body: typeof value.body === "string" ? value.body : undefined,
    notificationId:
      typeof value.notificationId === "string"
        ? value.notificationId
        : undefined,
    tag: typeof value.tag === "string" ? value.tag : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
  };
};

/** @type {(value: string | undefined, fallback: string) => string} */
const textOrFallback = (value, fallback) => {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value;
};

/** @type {(value: string | undefined) => string | undefined} */
const nonEmpty = (value) =>
  value === undefined || value === "" ? undefined : value;

/** @type {(client: Client) => client is WindowClient} */
const isWindowClient = (client) => "focus" in client && "navigate" in client;

/** @type {(targetUrl: string) => Promise<void>} */
const focusOrOpenClient = async (targetUrl) => {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });
  const existingClient = clients.find(isWindowClient);

  if (existingClient) {
    await existingClient.navigate(targetUrl);
    await existingClient.focus();
    return;
  }

  await self.clients.openWindow(targetUrl);
};

self.addEventListener("push", (event) => {
  const payload = event.data ? parsePayload(event.data.json()) : {};

  event.waitUntil(
    self.registration.showNotification(textOrFallback(payload.title, "Mangy"), {
      body: textOrFallback(payload.body, "You have a new notification."),
      data: {
        url: textOrFallback(payload.url, "/notifications"),
      },
      tag: nonEmpty(payload.tag) ?? nonEmpty(payload.notificationId),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    textOrFallback(parsePayload(event.notification.data).url, "/notifications"),
    self.location.origin
  ).toString();

  event.waitUntil(focusOrOpenClient(targetUrl));
});
