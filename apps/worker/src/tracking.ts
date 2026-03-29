import { db } from "@mangy/db";
import {
  chapter,
  downloadDestination,
  downloadJob,
  libraryEntry,
  series,
  trackedSeriesState,
} from "@mangy/db/schema";
import { env } from "@mangy/env";
import type { SourceChapter } from "@mangy/source-sdk";
import { sourceRegistry } from "@mangy/source-sdk/registry";
import { and, eq, inArray, sql } from "drizzle-orm";

import { queueNotificationForTransaction } from "./notifications";

const activeDownloadJobStatuses = [
  "queued",
  "running",
  "retryableFailed",
] as const;

const getTrackingPollIntervalMs = (): number => {
  const intervalMs = Number(env.TRACKING_POLL_INTERVAL_MS);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return 900_000;
  }

  return intervalMs;
};

const getNextCheckAt = (multiplier = 1): Date =>
  new Date(Date.now() + getTrackingPollIntervalMs() * multiplier);

const mapChapterValues = (seriesId: string, item: SourceChapter) => ({
  seriesId,
  externalId: item.externalId,
  title: item.title,
  chapterNumber: item.chapterNumber,
  volumeNumber: item.volumeNumber,
  translatedLanguage: item.translatedLanguage,
  externalUrl: item.externalUrl,
  sourceOrder: item.sourceOrder,
  pageCount: item.pageCount,
  publishedAt: item.publishedAt,
  isUnavailable: item.isUnavailable,
});

const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

const buildTrackedSeriesTitle = (seriesTitle: string): string =>
  `Tracking update: ${seriesTitle}`;

export interface ClaimedTrackedSeries {
  autoDownload: boolean;
  checkFailureCount: number;
  downloadDestinationId: string | null;
  downloadDestinationName: string | null;
  id: string;
  lastSeenChapterExternalId: string | null;
  libraryEntryId: string;
  seriesExternalId: string;
  seriesRecordId: string;
  seriesSourceId: string;
  seriesTitle: string;
  userId: string;
}

const upsertTrackedChapters = async (
  seriesId: string,
  items: SourceChapter[]
): Promise<void> => {
  for (const item of items) {
    await db
      .insert(chapter)
      .values(mapChapterValues(seriesId, item))
      .onConflictDoUpdate({
        target: [chapter.seriesId, chapter.externalId],
        set: {
          title: item.title,
          chapterNumber: item.chapterNumber,
          volumeNumber: item.volumeNumber,
          translatedLanguage: item.translatedLanguage,
          externalUrl: item.externalUrl,
          sourceOrder: item.sourceOrder,
          pageCount: item.pageCount,
          publishedAt: item.publishedAt,
          isUnavailable: item.isUnavailable,
          updatedAt: new Date(),
        },
      });
  }
};

const collectNewChapters = (
  chapters: SourceChapter[],
  lastSeenChapterExternalId: string | null
): SourceChapter[] => {
  if (!lastSeenChapterExternalId) {
    return [];
  }

  const hasSeenChapter = chapters.some(
    (item) => item.externalId === lastSeenChapterExternalId
  );
  if (!hasSeenChapter) {
    return [];
  }

  const newChapters: SourceChapter[] = [];

  for (const item of chapters) {
    if (item.externalId === lastSeenChapterExternalId) {
      break;
    }

    newChapters.push(item);
  }

  return newChapters;
};

const queueTrackedChapters = async (
  trackedSeries: ClaimedTrackedSeries,
  newChapters: SourceChapter[]
): Promise<number> => {
  if (!trackedSeries.downloadDestinationId) {
    throw new Error("Tracked auto-download is missing a destination.");
  }

  const chapterExternalIds = newChapters.map((item) => item.externalId);
  const storedChapters = await db
    .select({
      id: chapter.id,
      externalId: chapter.externalId,
      isDownloaded: chapter.isDownloaded,
    })
    .from(chapter)
    .where(
      and(
        eq(chapter.seriesId, trackedSeries.seriesRecordId),
        inArray(chapter.externalId, chapterExternalIds)
      )
    );

  const storedChapterIds = storedChapters.map((item) => item.id);
  const activeJobs = storedChapterIds.length
    ? await db
        .select({ chapterId: downloadJob.chapterId })
        .from(downloadJob)
        .where(
          and(
            eq(downloadJob.userId, trackedSeries.userId),
            inArray(downloadJob.chapterId, storedChapterIds),
            inArray(downloadJob.status, activeDownloadJobStatuses)
          )
        )
    : [];

  const activeChapterIds = new Set(
    activeJobs
      .map((item) => item.chapterId)
      .filter((chapterId): chapterId is string => Boolean(chapterId))
  );
  const chaptersByExternalId = new Map(
    storedChapters.map((item) => [item.externalId, item])
  );

  const queueableChapters = [...newChapters]
    .reverse()
    .map((item) => chaptersByExternalId.get(item.externalId))
    .filter(
      (
        item
      ): item is { id: string; externalId: string; isDownloaded: boolean } => {
        if (!item) {
          return false;
        }

        return !(item.isDownloaded || activeChapterIds.has(item.id));
      }
    );

  if (queueableChapters.length === 0) {
    return 0;
  }

  await db.insert(downloadJob).values(
    queueableChapters.map((item) => ({
      chapterId: item.id,
      downloadDestinationId: trackedSeries.downloadDestinationId,
      progressPercent: 0,
      seriesId: trackedSeries.seriesRecordId,
      userId: trackedSeries.userId,
    }))
  );

  return queueableChapters.length;
};

const completeTrackedSeriesCheck = async (
  trackedSeries: ClaimedTrackedSeries,
  latestChapterExternalId: string | null,
  notificationBody: string | null
): Promise<void> => {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(trackedSeriesState)
      .set({
        checkFailureCount: 0,
        lastCheckedAt: now,
        lastSeenChapterExternalId:
          latestChapterExternalId ?? trackedSeries.lastSeenChapterExternalId,
        nextCheckAt: getNextCheckAt(),
        updatedAt: now,
      })
      .where(eq(trackedSeriesState.id, trackedSeries.id));

    if (notificationBody) {
      await queueNotificationForTransaction(tx, {
        body: notificationBody,
        title: buildTrackedSeriesTitle(trackedSeries.seriesTitle),
        type: "trackedSeriesUpdated",
        userId: trackedSeries.userId,
      });
    }
  });
};

export const claimDueTrackedSeries =
  async (): Promise<ClaimedTrackedSeries | null> => {
    const provisionalNextCheckAt = getNextCheckAt();
    const result = await db.execute(sql<{ id: string }>`
    update "tracked_series_state"
    set
      "next_check_at" = ${provisionalNextCheckAt},
      "updated_at" = now()
    where "id" = (
      select tss."id"
      from "tracked_series_state" tss
      inner join "library_entry" le on le."id" = tss."library_entry_id"
      where le."is_tracked" = true
        and (tss."next_check_at" is null or tss."next_check_at" <= now())
      order by coalesce(tss."next_check_at", to_timestamp(0)) asc, tss."updated_at" asc
      for update skip locked
      limit 1
    )
    returning "id";
  `);

    const trackedStateId = result.rows[0]?.id as string | undefined;
    if (!trackedStateId) {
      return null;
    }

    const [trackedSeries] = await db
      .select({
        autoDownload: libraryEntry.autoDownload,
        checkFailureCount: trackedSeriesState.checkFailureCount,
        downloadDestinationId: libraryEntry.downloadDestinationId,
        downloadDestinationName: downloadDestination.name,
        id: trackedSeriesState.id,
        lastSeenChapterExternalId: trackedSeriesState.lastSeenChapterExternalId,
        libraryEntryId: libraryEntry.id,
        seriesExternalId: series.externalId,
        seriesRecordId: series.id,
        seriesSourceId: series.sourceId,
        seriesTitle: series.title,
        userId: libraryEntry.userId,
      })
      .from(trackedSeriesState)
      .innerJoin(
        libraryEntry,
        eq(trackedSeriesState.libraryEntryId, libraryEntry.id)
      )
      .innerJoin(series, eq(libraryEntry.seriesId, series.id))
      .leftJoin(
        downloadDestination,
        eq(libraryEntry.downloadDestinationId, downloadDestination.id)
      )
      .where(eq(trackedSeriesState.id, trackedStateId))
      .limit(1);

    return trackedSeries ?? null;
  };

export const processTrackedSeries = async (
  trackedSeries: ClaimedTrackedSeries
): Promise<void> => {
  const adapter = sourceRegistry.get(trackedSeries.seriesSourceId);
  if (!adapter) {
    throw new Error(
      `No source adapter is registered for ${trackedSeries.seriesSourceId}.`
    );
  }

  const chapters = await adapter.getChapters(trackedSeries.seriesExternalId);
  await upsertTrackedChapters(trackedSeries.seriesRecordId, chapters);

  const latestChapterExternalId =
    chapters[0]?.externalId ?? trackedSeries.lastSeenChapterExternalId;
  const newChapters = collectNewChapters(
    chapters,
    trackedSeries.lastSeenChapterExternalId
  );

  let notificationBody: string | null = null;

  if (newChapters.length > 0) {
    if (trackedSeries.autoDownload) {
      const queuedCount = await queueTrackedChapters(
        trackedSeries,
        newChapters
      );

      if (queuedCount > 0) {
        notificationBody = `${queuedCount} new ${pluralize(queuedCount, "chapter", "chapters")} queued${trackedSeries.downloadDestinationName ? ` to ${trackedSeries.downloadDestinationName}` : ""}.`;
      }
    } else {
      notificationBody = `${newChapters.length} new ${pluralize(newChapters.length, "chapter", "chapters")} found. Auto-download is off.`;
    }
  }

  await completeTrackedSeriesCheck(
    trackedSeries,
    latestChapterExternalId,
    notificationBody
  );
};

export const failTrackedSeries = async (
  trackedSeries: ClaimedTrackedSeries,
  error: unknown
): Promise<void> => {
  const nextFailureCount = trackedSeries.checkFailureCount + 1;
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected tracked-series worker error.";
  const shouldNotify = nextFailureCount >= 3;

  await db.transaction(async (tx) => {
    await tx
      .update(trackedSeriesState)
      .set({
        checkFailureCount: nextFailureCount,
        nextCheckAt: getNextCheckAt(2 ** Math.min(nextFailureCount, 4)),
        updatedAt: new Date(),
      })
      .where(eq(trackedSeriesState.id, trackedSeries.id));

    if (shouldNotify) {
      await queueNotificationForTransaction(tx, {
        body: `Tracking check failed. ${message}`,
        title: buildTrackedSeriesTitle(trackedSeries.seriesTitle),
        type: "systemWarning",
        userId: trackedSeries.userId,
      });
    }
  });
};
