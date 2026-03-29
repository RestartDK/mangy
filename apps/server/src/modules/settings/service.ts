import { mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { db } from "@mangy/db";
import {
  downloadDestination,
  downloadJob,
  libraryEntry,
  notificationEndpoint,
  pushSubscription,
} from "@mangy/db/schema";
import {
  BrowserPushError,
  getBrowserPushPublicKey,
  hasBrowserPushConfig,
  sendBrowserPush,
} from "@mangy/push";
import { and, asc, eq, inArray } from "drizzle-orm";

import { NotificationsService } from "../notifications/service";

const activeDownloadJobStatuses = [
  "queued",
  "running",
  "retryableFailed",
] as const;

interface UserProfile {
  email: string;
  name: string;
}

interface BrowserPushPreferencesInput {
  isEnabled: boolean;
  notifyOnDownloadCompleted: boolean;
  notifyOnDownloadFailed: boolean;
  notifyOnTrackedSeriesUpdate: boolean;
  notifyOnSystemWarning: boolean;
}

interface BrowserPushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
}

type DbTransaction = Pick<typeof db, "insert" | "select" | "update">;

const defaultBrowserPushPreferences: BrowserPushPreferencesInput = {
  isEnabled: false,
  notifyOnDownloadCompleted: true,
  notifyOnDownloadFailed: true,
  notifyOnTrackedSeriesUpdate: true,
  notifyOnSystemWarning: true,
};

const toIsoString = (value: Date | null): string | null => {
  return value ? value.toISOString() : null;
};

const getBrowserPushEndpointRecord = async (userId: string) => {
  const [record] = await db
    .select({
      id: notificationEndpoint.id,
      isEnabled: notificationEndpoint.isEnabled,
      lastDeliveredAt: notificationEndpoint.lastDeliveredAt,
      lastError: notificationEndpoint.lastError,
      lastErrorAt: notificationEndpoint.lastErrorAt,
      notifyOnDownloadCompleted: notificationEndpoint.notifyOnDownloadCompleted,
      notifyOnDownloadFailed: notificationEndpoint.notifyOnDownloadFailed,
      notifyOnTrackedSeriesUpdate:
        notificationEndpoint.notifyOnTrackedSeriesUpdate,
      notifyOnSystemWarning: notificationEndpoint.notifyOnSystemWarning,
    })
    .from(notificationEndpoint)
    .where(
      and(
        eq(notificationEndpoint.userId, userId),
        eq(notificationEndpoint.type, "browserPush")
      )
    )
    .limit(1);

  return record ?? null;
};

const countActivePushSubscriptions = async (
  userId: string
): Promise<number> => {
  const rows = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, userId),
        eq(pushSubscription.isActive, true)
      )
    );

  return rows.length;
};

const upsertBrowserPushEndpoint = async (
  transaction: DbTransaction,
  userId: string,
  input: Partial<BrowserPushPreferencesInput>
) => {
  const [existingEndpoint] = await transaction
    .select({
      id: notificationEndpoint.id,
      isEnabled: notificationEndpoint.isEnabled,
      notifyOnDownloadCompleted: notificationEndpoint.notifyOnDownloadCompleted,
      notifyOnDownloadFailed: notificationEndpoint.notifyOnDownloadFailed,
      notifyOnTrackedSeriesUpdate:
        notificationEndpoint.notifyOnTrackedSeriesUpdate,
      notifyOnSystemWarning: notificationEndpoint.notifyOnSystemWarning,
    })
    .from(notificationEndpoint)
    .where(
      and(
        eq(notificationEndpoint.userId, userId),
        eq(notificationEndpoint.type, "browserPush")
      )
    )
    .limit(1);

  const values = {
    isEnabled:
      input.isEnabled ??
      existingEndpoint?.isEnabled ??
      defaultBrowserPushPreferences.isEnabled,
    notifyOnDownloadCompleted:
      input.notifyOnDownloadCompleted ??
      existingEndpoint?.notifyOnDownloadCompleted ??
      defaultBrowserPushPreferences.notifyOnDownloadCompleted,
    notifyOnDownloadFailed:
      input.notifyOnDownloadFailed ??
      existingEndpoint?.notifyOnDownloadFailed ??
      defaultBrowserPushPreferences.notifyOnDownloadFailed,
    notifyOnTrackedSeriesUpdate:
      input.notifyOnTrackedSeriesUpdate ??
      existingEndpoint?.notifyOnTrackedSeriesUpdate ??
      defaultBrowserPushPreferences.notifyOnTrackedSeriesUpdate,
    notifyOnSystemWarning:
      input.notifyOnSystemWarning ??
      existingEndpoint?.notifyOnSystemWarning ??
      defaultBrowserPushPreferences.notifyOnSystemWarning,
    updatedAt: new Date(),
  };

  if (existingEndpoint) {
    await transaction
      .update(notificationEndpoint)
      .set(values)
      .where(eq(notificationEndpoint.id, existingEndpoint.id));

    return existingEndpoint.id;
  }

  const [createdEndpoint] = await transaction
    .insert(notificationEndpoint)
    .values({
      ...values,
      type: "browserPush",
      userId,
    })
    .returning({ id: notificationEndpoint.id });

  if (!createdEndpoint) {
    throw new Error("Unable to save browser notification settings.");
  }

  return createdEndpoint.id;
};

const toExpirationDate = (value: number | null | undefined): Date | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value);
};

const assertValidPushEndpoint = (value: string): void => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("Push subscriptions must include a valid endpoint URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Push subscriptions must use an HTTPS endpoint.");
  }
};

const updateBrowserPushObservability = async (
  userId: string,
  input: {
    lastDeliveredAt?: Date | null;
    lastError?: string | null;
    lastErrorAt?: Date | null;
  }
) => {
  const endpoint = await getBrowserPushEndpointRecord(userId);

  if (!endpoint) {
    return;
  }

  await db
    .update(notificationEndpoint)
    .set({
      lastDeliveredAt:
        input.lastDeliveredAt === undefined
          ? endpoint.lastDeliveredAt
          : input.lastDeliveredAt,
      lastError:
        input.lastError === undefined ? endpoint.lastError : input.lastError,
      lastErrorAt:
        input.lastErrorAt === undefined
          ? endpoint.lastErrorAt
          : input.lastErrorAt,
      updatedAt: new Date(),
    })
    .where(eq(notificationEndpoint.id, endpoint.id));
};

export const SettingsService = {
  async getBootstrap(userId: string, profile: UserProfile) {
    const [destinations, notifications] = await Promise.all([
      db
        .select({
          id: downloadDestination.id,
          name: downloadDestination.name,
          absolutePath: downloadDestination.absolutePath,
          komgaLibraryId: downloadDestination.komgaLibraryId,
          isDefault: downloadDestination.isDefault,
          isEnabled: downloadDestination.isEnabled,
        })
        .from(downloadDestination)
        .where(eq(downloadDestination.userId, userId))
        .orderBy(asc(downloadDestination.name)),
      NotificationsService.getPreferences(userId),
    ]);

    return {
      destinations: destinations.map((destination) => ({
        ...destination,
        komgaLibraryId: destination.komgaLibraryId ?? null,
      })),
      notifications,
      profile,
    };
  },

  async getBrowserPushSettings(userId: string) {
    const [endpoint, activeSubscriptionCount] = await Promise.all([
      getBrowserPushEndpointRecord(userId),
      countActivePushSubscriptions(userId),
    ]);

    return {
      activeSubscriptionCount,
      isConfigured: hasBrowserPushConfig(),
      isEnabled: endpoint?.isEnabled ?? defaultBrowserPushPreferences.isEnabled,
      lastDeliveredAt: toIsoString(endpoint?.lastDeliveredAt ?? null),
      lastError: endpoint?.lastError ?? null,
      lastErrorAt: toIsoString(endpoint?.lastErrorAt ?? null),
      notifyOnDownloadCompleted:
        endpoint?.notifyOnDownloadCompleted ??
        defaultBrowserPushPreferences.notifyOnDownloadCompleted,
      notifyOnDownloadFailed:
        endpoint?.notifyOnDownloadFailed ??
        defaultBrowserPushPreferences.notifyOnDownloadFailed,
      notifyOnTrackedSeriesUpdate:
        endpoint?.notifyOnTrackedSeriesUpdate ??
        defaultBrowserPushPreferences.notifyOnTrackedSeriesUpdate,
      notifyOnSystemWarning:
        endpoint?.notifyOnSystemWarning ??
        defaultBrowserPushPreferences.notifyOnSystemWarning,
      vapidPublicKey: getBrowserPushPublicKey(),
    };
  },

  async updateBrowserPushPreferences(
    userId: string,
    input: BrowserPushPreferencesInput
  ) {
    await db.transaction(async (tx) => {
      await upsertBrowserPushEndpoint(tx, userId, input);
    });

    return SettingsService.getBrowserPushSettings(userId);
  },

  async savePushSubscription(
    userId: string,
    input: BrowserPushSubscriptionInput
  ) {
    assertValidPushEndpoint(input.endpoint);

    await db.transaction(async (tx) => {
      await upsertBrowserPushEndpoint(tx, userId, { isEnabled: true });

      const [existingSubscription] = await tx
        .select({ id: pushSubscription.id })
        .from(pushSubscription)
        .where(eq(pushSubscription.endpoint, input.endpoint))
        .limit(1);

      const values = {
        auth: input.keys.auth,
        endpoint: input.endpoint,
        expirationTime: toExpirationDate(input.expirationTime),
        isActive: true,
        lastError: null,
        lastSeenAt: new Date(),
        p256dh: input.keys.p256dh,
        updatedAt: new Date(),
        userAgent: input.userAgent?.trim() || null,
        userId,
      };

      if (existingSubscription) {
        await tx
          .update(pushSubscription)
          .set(values)
          .where(eq(pushSubscription.id, existingSubscription.id));
      } else {
        await tx.insert(pushSubscription).values(values);
      }
    });

    return SettingsService.getBrowserPushSettings(userId);
  },

  async removePushSubscription(userId: string, input: { endpoint: string }) {
    assertValidPushEndpoint(input.endpoint);

    await db.transaction(async (tx) => {
      await tx
        .update(pushSubscription)
        .set({
          isActive: false,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(pushSubscription.userId, userId),
            eq(pushSubscription.endpoint, input.endpoint)
          )
        );

      const remainingSubscriptions = await tx
        .select({ id: pushSubscription.id })
        .from(pushSubscription)
        .where(
          and(
            eq(pushSubscription.userId, userId),
            eq(pushSubscription.isActive, true)
          )
        )
        .limit(1);

      if (remainingSubscriptions.length === 0) {
        await upsertBrowserPushEndpoint(tx, userId, { isEnabled: false });
      }
    });

    return SettingsService.getBrowserPushSettings(userId);
  },

  async sendTestBrowserPush(userId: string) {
    const subscriptions = await db
      .select({
        auth: pushSubscription.auth,
        endpoint: pushSubscription.endpoint,
        id: pushSubscription.id,
        p256dh: pushSubscription.p256dh,
      })
      .from(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, userId),
          eq(pushSubscription.isActive, true)
        )
      );

    if (subscriptions.length === 0) {
      throw new Error("Connect a browser before sending a test notification.");
    }

    let deliveredCount = 0;
    let lastError: BrowserPushError | Error | null = null;

    for (const subscription of subscriptions) {
      try {
        await sendBrowserPush(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh,
            },
          },
          {
            body: "Mangy can send browser notifications to this browser.",
            tag: "browser-push-test",
            title: "Browser notifications ready",
            type: "systemWarning",
            url: "/notifications",
          }
        );

        deliveredCount += 1;

        await db
          .update(pushSubscription)
          .set({
            lastError: null,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(pushSubscription.id, subscription.id));
      } catch (error) {
        const pushError =
          error instanceof BrowserPushError
            ? error
            : new BrowserPushError(
                error instanceof Error && error.message.trim().length > 0
                  ? error.message
                  : "Unable to send a browser test notification."
              );

        lastError = pushError;

        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          await db
            .update(pushSubscription)
            .set({
              isActive: false,
              lastError: pushError.message,
              updatedAt: new Date(),
            })
            .where(eq(pushSubscription.id, subscription.id));
        } else {
          await db
            .update(pushSubscription)
            .set({
              lastError: pushError.message,
              updatedAt: new Date(),
            })
            .where(eq(pushSubscription.id, subscription.id));
        }
      }
    }

    if (deliveredCount > 0) {
      await updateBrowserPushObservability(userId, {
        lastDeliveredAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      });

      return { deliveredCount };
    }

    await updateBrowserPushObservability(userId, {
      lastError:
        lastError?.message ?? "Unable to send a browser test notification.",
      lastErrorAt: new Date(),
    });

    throw lastError ?? new Error("Unable to send a browser test notification.");
  },

  async createDestination(
    userId: string,
    input: {
      name: string;
      absolutePath: string;
      komgaLibraryId?: string;
      isDefault?: boolean;
    }
  ) {
    const absolutePath = input.absolutePath.trim();
    if (!isAbsolute(absolutePath)) {
      throw new Error("Destination paths must be absolute.");
    }

    await mkdir(absolutePath, { recursive: true });

    return db.transaction(async (tx) => {
      const existingDestinations = await tx
        .select({ id: downloadDestination.id })
        .from(downloadDestination)
        .where(eq(downloadDestination.userId, userId));

      const shouldBeDefault =
        input.isDefault === true || existingDestinations.length === 0;

      if (shouldBeDefault) {
        await tx
          .update(downloadDestination)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(downloadDestination.userId, userId));
      }

      const [destination] = await tx
        .insert(downloadDestination)
        .values({
          absolutePath,
          isDefault: shouldBeDefault,
          komgaLibraryId: input.komgaLibraryId?.trim() || null,
          name: input.name.trim(),
          userId,
        })
        .returning({
          absolutePath: downloadDestination.absolutePath,
          id: downloadDestination.id,
          isDefault: downloadDestination.isDefault,
          isEnabled: downloadDestination.isEnabled,
          komgaLibraryId: downloadDestination.komgaLibraryId,
          name: downloadDestination.name,
        });

      if (!destination) {
        throw new Error("Unable to save this destination.");
      }

      return {
        ...destination,
        komgaLibraryId: destination.komgaLibraryId ?? null,
      };
    });
  },

  async deleteDestination(userId: string, destinationId: string) {
    return await db.transaction(async (tx) => {
      const destinations = await tx
        .select({
          id: downloadDestination.id,
          isDefault: downloadDestination.isDefault,
          isEnabled: downloadDestination.isEnabled,
        })
        .from(downloadDestination)
        .where(eq(downloadDestination.userId, userId))
        .orderBy(asc(downloadDestination.name));

      const destination = destinations.find(
        (item) => item.id === destinationId
      );
      if (!destination) {
        throw new Error("Destination not found.");
      }

      const [activeJob] = await tx
        .select({ id: downloadJob.id })
        .from(downloadJob)
        .where(
          and(
            eq(downloadJob.userId, userId),
            eq(downloadJob.downloadDestinationId, destinationId),
            inArray(downloadJob.status, activeDownloadJobStatuses)
          )
        )
        .limit(1);

      if (activeJob) {
        throw new Error(
          "This destination is still used by queued or running downloads. Cancel or finish those jobs first."
        );
      }

      const fallbackDestination = destination.isDefault
        ? (destinations.find(
            (item) => item.id !== destinationId && item.isEnabled
          ) ?? destinations.find((item) => item.id !== destinationId))
        : null;
      const now = new Date();

      await tx
        .update(libraryEntry)
        .set({
          autoDownload: false,
          downloadDestinationId: null,
          updatedAt: now,
        })
        .where(eq(libraryEntry.downloadDestinationId, destinationId));

      await tx
        .delete(downloadDestination)
        .where(
          and(
            eq(downloadDestination.id, destinationId),
            eq(downloadDestination.userId, userId)
          )
        );

      if (destination.isDefault && fallbackDestination) {
        await tx
          .update(downloadDestination)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(downloadDestination.userId, userId));

        await tx
          .update(downloadDestination)
          .set({ isDefault: true, updatedAt: now })
          .where(eq(downloadDestination.id, fallbackDestination.id));
      }

      return { id: destinationId };
    });
  },
};
