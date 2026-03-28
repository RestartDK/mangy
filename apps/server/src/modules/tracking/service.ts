import { db } from "@mangy/db";
import { libraryEntry, series, trackedSeriesState } from "@mangy/db/schema";
import { desc, eq } from "drizzle-orm";

export abstract class TrackingService {
  static async list(userId: string) {
    const rows = await db
      .select({
        id: trackedSeriesState.id,
        sourceId: series.sourceId,
        seriesId: series.externalId,
        title: series.title,
        nextCheckAt: trackedSeriesState.nextCheckAt,
        lastCheckedAt: trackedSeriesState.lastCheckedAt,
        lastSeenChapterExternalId: trackedSeriesState.lastSeenChapterExternalId,
        checkFailureCount: trackedSeriesState.checkFailureCount,
      })
      .from(trackedSeriesState)
      .innerJoin(
        libraryEntry,
        eq(trackedSeriesState.libraryEntryId, libraryEntry.id)
      )
      .innerJoin(series, eq(libraryEntry.seriesId, series.id))
      .where(eq(libraryEntry.userId, userId))
      .orderBy(desc(trackedSeriesState.updatedAt));

    return rows.map((row) => ({
      ...row,
      nextCheckAt: row.nextCheckAt ? row.nextCheckAt.toISOString() : null,
      lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
      lastSeenChapterExternalId: row.lastSeenChapterExternalId ?? null,
    }));
  }
}
