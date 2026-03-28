import { db } from "@mangy/db";
import { notification } from "@mangy/db/schema";
import { desc, eq } from "drizzle-orm";

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
}
