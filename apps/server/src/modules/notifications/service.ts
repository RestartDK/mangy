import { db } from "@mangy/db";
import { notification, notificationEndpoint } from "@mangy/db/schema";
import { and, count, desc, eq } from "drizzle-orm";

export abstract class NotificationsService {
  static async list(userId: string) {
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt));

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  static async markRead(userId: string, notificationId: string) {
    const [record] = await db
      .update(notification)
      .set({
        isRead: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.id, notificationId)
        )
      )
      .returning({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });

    if (!record) {
      throw new Error("Notification not found.");
    }

    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
    };
  }

  static async markAllRead(userId: string) {
    const records = await db
      .update(notification)
      .set({
        isRead: true,
        updatedAt: new Date(),
      })
      .where(
        and(eq(notification.userId, userId), eq(notification.isRead, false))
      )
      .returning({ id: notification.id });

    return { updatedCount: records.length };
  }

  static async getPreferences(userId: string) {
    const [endpoint, unreadRecord] = await Promise.all([
      db
        .select({ isEnabled: notificationEndpoint.isEnabled })
        .from(notificationEndpoint)
        .where(
          and(
            eq(notificationEndpoint.userId, userId),
            eq(notificationEndpoint.type, "inApp")
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ unreadCount: count() })
        .from(notification)
        .where(
          and(eq(notification.userId, userId), eq(notification.isRead, false))
        )
        .then((rows) => rows[0] ?? { unreadCount: 0 }),
    ]);

    return {
      inAppEnabled: endpoint?.isEnabled ?? true,
      unreadCount: Number(unreadRecord.unreadCount ?? 0),
    };
  }

  static async updatePreferences(
    userId: string,
    input: { inAppEnabled: boolean }
  ) {
    const [existingEndpoint] = await db
      .select({ id: notificationEndpoint.id })
      .from(notificationEndpoint)
      .where(
        and(
          eq(notificationEndpoint.userId, userId),
          eq(notificationEndpoint.type, "inApp")
        )
      )
      .limit(1);

    if (existingEndpoint) {
      await db
        .update(notificationEndpoint)
        .set({
          isEnabled: input.inAppEnabled,
          updatedAt: new Date(),
        })
        .where(eq(notificationEndpoint.id, existingEndpoint.id));
    } else {
      await db.insert(notificationEndpoint).values({
        isEnabled: input.inAppEnabled,
        type: "inApp",
        userId,
      });
    }

    return NotificationsService.getPreferences(userId);
  }
}
