import { db } from "@mangy/db";
import {
  downloadJob,
  libraryEntry,
  notification,
  trackedSeriesState,
} from "@mangy/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { getSessionUser } from "@/lib/auth";

interface LiveSnapshot {
  downloadsUpdatedAt: string | null;
  notificationsUpdatedAt: string | null;
  notificationsUnreadCount: number;
  trackingUpdatedAt: string | null;
}

const getSnapshot = async (userId: string): Promise<LiveSnapshot> => {
  const [downloadRecord, notificationRecord, unreadRecord, trackingRecord] =
    await Promise.all([
      db
        .select({ updatedAt: downloadJob.updatedAt })
        .from(downloadJob)
        .where(eq(downloadJob.userId, userId))
        .orderBy(desc(downloadJob.updatedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ updatedAt: notification.updatedAt })
        .from(notification)
        .where(eq(notification.userId, userId))
        .orderBy(desc(notification.updatedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: notification.id })
        .from(notification)
        .where(
          and(eq(notification.userId, userId), eq(notification.isRead, false))
        )
        .then((rows) => rows.length),
      db
        .select({ updatedAt: trackedSeriesState.updatedAt })
        .from(trackedSeriesState)
        .innerJoin(
          libraryEntry,
          eq(trackedSeriesState.libraryEntryId, libraryEntry.id)
        )
        .where(eq(libraryEntry.userId, userId))
        .orderBy(desc(trackedSeriesState.updatedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  return {
    downloadsUpdatedAt: downloadRecord?.updatedAt?.toISOString() ?? null,
    notificationsUpdatedAt:
      notificationRecord?.updatedAt?.toISOString() ?? null,
    notificationsUnreadCount: unreadRecord,
    trackingUpdatedAt: trackingRecord?.updatedAt?.toISOString() ?? null,
  };
};

const hasSnapshotChanged = (left: LiveSnapshot, right: LiveSnapshot): boolean =>
  left.downloadsUpdatedAt !== right.downloadsUpdatedAt ||
  left.notificationsUpdatedAt !== right.notificationsUpdatedAt ||
  left.notificationsUnreadCount !== right.notificationsUnreadCount ||
  left.trackingUpdatedAt !== right.trackingUpdatedAt;

const formatSseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const live = new Elysia({ prefix: "/api/live" }).get(
  "/events",
  async ({ request, set }) => {
    const user = await getSessionUser(request);
    if (!user) {
      set.status = 401;
      return { message: "Unauthorized" };
    }

    const encoder = new TextEncoder();
    const initialSnapshot = await getSnapshot(user.id);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let lastSnapshot = initialSnapshot;
        let isClosed = false;
        let isPolling = false;

        const send = (event: string, data: unknown) => {
          if (isClosed) {
            return;
          }

          controller.enqueue(encoder.encode(formatSseEvent(event, data)));
        };

        const cleanup = () => {
          if (isClosed) {
            return;
          }

          isClosed = true;
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        };

        const poll = async () => {
          if (isClosed || isPolling) {
            return;
          }

          isPolling = true;

          try {
            const nextSnapshot = await getSnapshot(user.id);
            if (hasSnapshotChanged(lastSnapshot, nextSnapshot)) {
              send("state", {
                downloadsChanged:
                  nextSnapshot.downloadsUpdatedAt !==
                  lastSnapshot.downloadsUpdatedAt,
                notificationsChanged:
                  nextSnapshot.notificationsUpdatedAt !==
                    lastSnapshot.notificationsUpdatedAt ||
                  nextSnapshot.notificationsUnreadCount !==
                    lastSnapshot.notificationsUnreadCount,
                snapshot: nextSnapshot,
                trackingChanged:
                  nextSnapshot.trackingUpdatedAt !==
                  lastSnapshot.trackingUpdatedAt,
              });
              lastSnapshot = nextSnapshot;
            }
          } finally {
            isPolling = false;
          }
        };

        send("connected", { snapshot: initialSnapshot });

        const pollInterval = setInterval(() => {
          poll().catch(() => {
            cleanup();
          });
        }, 1500);
        const heartbeatInterval = setInterval(() => {
          send("heartbeat", { timestamp: Date.now() });
        }, 15_000);

        request.signal.addEventListener("abort", cleanup, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      },
    });
  }
);
