declare module "web-push" {
  interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      auth: string;
      p256dh: string;
    };
  }

  interface WebPushStatic {
    sendNotification(
      subscription: PushSubscription,
      payload?: string
    ): Promise<void>;
    setVapidDetails(
      subject: string,
      publicKey: string,
      privateKey: string
    ): void;
  }

  const webpush: WebPushStatic;
  export default webpush;
}
