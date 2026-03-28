import { db } from "@mangy/db";
import { libraryEntry, series, trackedSeriesState } from "@mangy/db/schema";
import { and, desc, eq, type SQL } from "drizzle-orm";

const serializeTrackedSeries = (row: {
  id: string;
  sourceId: string;
  seriesId: string;
  title: string;
  nextCheckAt: Date | null;
  lastCheckedAt: Date | null;
  lastSeenChapterExternalId: string | null;
  checkFailureCount: number;
}) => ({
  ...row,
  nextCheckAt: row.nextCheckAt ? row.nextCheckAt.toISOString() : null,
  lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
  lastSeenChapterExternalId: row.lastSeenChapterExternalId ?? null,
});

export const TrackingService = {
  async list(userId: string) {
    const rows = await TrackingService.baseQuery(userId).orderBy(
      desc(trackedSeriesState.updatedAt)
    );

    return rows.map(serializeTrackedSeries);
  },

  async requestRefresh(userId: string, sourceId: string, seriesId: string) {
    const [trackedState] = await TrackingService.baseQuery(
      userId,
      and(eq(series.sourceId, sourceId), eq(series.externalId, seriesId))
    )
      .orderBy(desc(trackedSeriesState.updatedAt))
      .limit(1);

    if (!trackedState) {
      throw new Error("Track this series before requesting a refresh.");
    }

    await db
      .update(trackedSeriesState)
      .set({
        nextCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trackedSeriesState.id, trackedState.id));

    return {
      ...trackedState,
      nextCheckAt: new Date().toISOString(),
      lastCheckedAt: trackedState.lastCheckedAt
        ? trackedState.lastCheckedAt.toISOString()
        : null,
      lastSeenChapterExternalId: trackedState.lastSeenChapterExternalId ?? null,
    };
  },

  baseQuery(userId: string, extraWhere?: SQL<unknown>) {
    return db
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
      .where(
        extraWhere
          ? and(
              eq(libraryEntry.userId, userId),
              eq(libraryEntry.isTracked, true),
              extraWhere
            )
          : and(
              eq(libraryEntry.userId, userId),
              eq(libraryEntry.isTracked, true)
            )
      );
  },
};
