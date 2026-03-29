import { env } from "@mangy/env";
import webpush from "web-push";

export interface BrowserPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface BrowserPushPayload {
  body: string;
  notificationId?: string;
  tag?: string;
  title: string;
  type?: string;
  url: string;
}

type BrowserPushSender = (
  subscription: BrowserPushSubscription,
  payload: BrowserPushPayload
) => Promise<void>;

let senderOverride: BrowserPushSender | null = null;

export class BrowserPushError extends Error {
  permanent: boolean;
  statusCode: number | null;

  constructor(message: string, options?: { permanent?: boolean; statusCode?: number | null }) {
    super(message);
    this.name = "BrowserPushError";
    this.permanent = options?.permanent ?? false;
    this.statusCode = options?.statusCode ?? null;
  }
}

const isConfigured = (): boolean => {
  return Boolean(
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
  );
};

const getConfiguredVapid = () => {
  if (!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)) {
    throw new BrowserPushError(
      "Browser push notifications are not configured yet.",
      { permanent: true }
    );
  }

  return {
    privateKey: env.VAPID_PRIVATE_KEY,
    publicKey: env.VAPID_PUBLIC_KEY,
    subject: env.VAPID_SUBJECT,
  };
};

const normalizeError = (error: unknown): BrowserPushError => {
  if (error instanceof BrowserPushError) {
    return error;
  }

  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
      ? error.statusCode
      : null;

  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Unable to deliver this browser notification.";

  return new BrowserPushError(message, {
    permanent: statusCode === 404 || statusCode === 410,
    statusCode,
  });
};

export const hasBrowserPushConfig = (): boolean => isConfigured();

export const getBrowserPushPublicKey = (): string | null => {
  return env.VAPID_PUBLIC_KEY ?? null;
};

export const setBrowserPushSenderForTests = (
  sender: BrowserPushSender | null
): void => {
  senderOverride = sender;
};

export const sendBrowserPush = async (
  subscription: BrowserPushSubscription,
  payload: BrowserPushPayload
): Promise<void> => {
  if (senderOverride) {
    await senderOverride(subscription, payload);
    return;
  }

  const vapid = getConfiguredVapid();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    throw normalizeError(error);
  }
};
