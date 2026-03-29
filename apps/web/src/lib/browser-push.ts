export interface SerializedPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface BrowserPushClientState {
  isSecureContext: boolean;
  isSubscribed: boolean;
  isSupported: boolean;
  permission: NotificationPermission | "secureContextRequired" | "unsupported";
  subscriptionEndpoint: string | null;
}

const serviceWorkerPath = "/push-sw.js";

const hasNotificationApi = (): boolean => {
  return typeof window !== "undefined" && "Notification" in window;
};

const hasPushManagerApi = (): boolean => {
  return typeof window !== "undefined" && "PushManager" in window;
};

const hasServiceWorkerApi = (): boolean => {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
};

const urlBase64ToUint8Array = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const rawData = window.atob(paddedValue);

  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
};

const serializePushSubscription = (
  subscription: PushSubscription
): SerializedPushSubscription => {
  const serialized = subscription.toJSON();
  const auth = serialized.keys?.auth;
  const p256dh = serialized.keys?.p256dh;

  if (!(auth && p256dh)) {
    throw new Error("This browser returned an incomplete push subscription.");
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      auth,
      p256dh,
    },
  };
};

export const isBrowserPushSupported = (): boolean => {
  if (!hasNotificationApi()) {
    return false;
  }

  if (!isBrowserPushSecureContext()) {
    return true;
  }

  return hasPushManagerApi();
};

export const isBrowserPushSecureContext = (): boolean => {
  return typeof window !== "undefined" && window.isSecureContext;
};

export const getBrowserPushClientState =
  async (): Promise<BrowserPushClientState> => {
    if (!isBrowserPushSupported()) {
      return {
        isSecureContext: false,
        isSubscribed: false,
        isSupported: false,
        permission: "unsupported",
        subscriptionEndpoint: null,
      };
    }

    if (!isBrowserPushSecureContext()) {
      return {
        isSecureContext: false,
        isSubscribed: false,
        isSupported: true,
        permission: "secureContextRequired",
        subscriptionEndpoint: null,
      };
    }

    if (!hasServiceWorkerApi()) {
      return {
        isSecureContext: true,
        isSubscribed: false,
        isSupported: false,
        permission: "unsupported",
        subscriptionEndpoint: null,
      };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null;

    return {
      isSecureContext: isBrowserPushSecureContext(),
      isSubscribed: subscription !== null,
      isSupported: true,
      permission: Notification.permission,
      subscriptionEndpoint: subscription?.endpoint ?? null,
    };
  };

export const registerPushServiceWorker =
  async (): Promise<ServiceWorkerRegistration | null> => {
    if (!isBrowserPushSupported()) {
      return null;
    }

    if (!isBrowserPushSecureContext()) {
      throw new Error(
        "Browser notifications require HTTPS or localhost. Open the app from a secure origin to enable them."
      );
    }

    if (!hasServiceWorkerApi()) {
      throw new Error(
        "This browser does not expose service workers for notifications."
      );
    }

    return navigator.serviceWorker.register(serviceWorkerPath);
  };

export const subscribeCurrentBrowserToPush = async (
  vapidPublicKey: string
): Promise<SerializedPushSubscription> => {
  if (!isBrowserPushSupported()) {
    throw new Error("This browser does not support push notifications.");
  }

  if (!isBrowserPushSecureContext()) {
    throw new Error(
      "Browser notifications require HTTPS or localhost. This page is using an insecure origin."
    );
  }

  if (!hasServiceWorkerApi()) {
    throw new Error(
      "This browser does not support the service worker APIs required for push notifications."
    );
  }

  const registration = await registerPushServiceWorker();
  if (!registration) {
    throw new Error("Unable to register the browser notification worker.");
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    return serializePushSubscription(existingSubscription);
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Browser notifications are blocked in this browser."
        : "Browser notification permission was not granted."
    );
  }

  const createdSubscription = await registration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    userVisibleOnly: true,
  });

  return serializePushSubscription(createdSubscription);
};

export const unsubscribeCurrentBrowserFromPush = async (): Promise<
  string | null
> => {
  if (!isBrowserPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (!subscription) {
    return null;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
};
