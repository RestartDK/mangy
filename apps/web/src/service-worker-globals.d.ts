interface ServiceWorkerPushPayload {
  body?: string;
  notificationId?: string;
  tag?: string;
  title?: string;
  url?: string;
}

interface Window {
  clients: Clients;
  registration: ServiceWorkerRegistration;
}

interface WindowEventMap {
  notificationclick: NotificationEvent;
  push: PushEvent;
}
