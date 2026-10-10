import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  chapterColumns,
  chapterRow,
  downloadDestinationColumns,
  downloadDestinationRow,
  downloadJobColumns,
  downloadJobRow,
  libraryEntryColumns,
  libraryEntryRow,
  seriesColumns,
  seriesRow,
  trackedSeriesStateColumns,
  trackedSeriesStateRow,
} from "@mangy/db/model";
import { env } from "@mangy/env";
import type { SourceChapter } from "@mangy/source-sdk";
import { sourceRegistry } from "@mangy/source-sdk/registry";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { queueNotification } from "./notifications";

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

const claimedTrackedSeriesProjection = Schema.Struct({
  autoDownload: libraryEntryRow.fields.auto_download,
  checkFailureCount: trackedSeriesStateRow.fields.check_failure_count,
  downloadDestinationId: Schema.NullOr(
    libraryEntryRow.fields.download_destination_id
  ),
  downloadDestinationName: Schema.NullOr(downloadDestinationRow.fields.name),
  id: trackedSeriesStateRow.fields.id,
  lastSeenChapterExternalId:
    trackedSeriesStateRow.fields.last_seen_chapter_external_id,
  libraryEntryId: libraryEntryRow.fields.id,
  seriesExternalId: seriesRow.fields.external_id,
  seriesRecordId: seriesRow.fields.id,
  seriesSourceId: seriesRow.fields.source_id,
  seriesTitle: seriesRow.fields.title,
  userId: libraryEntryRow.fields.user_id,
});

const upsertTrackedChapters = (seriesId: string, items: SourceChapter[]) =>
  Effect.gen(function* upsertTrackedChaptersEffect() {
    const sql = yield* SqlClient.SqlClient;

    for (const item of items) {
      yield* sql`INSERT INTO ${table("chapter")} ${insertRow(
        sql,
        chapterColumns,
        { id: crypto.randomUUID(), ...mapChapterValues(seriesId, item) }
      )}
        ON CONFLICT (${column(chapterColumns, "seriesId")}, ${column(chapterColumns, "externalId")}) DO UPDATE SET ${updateRow(
          sql,
          chapterColumns,
          {
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
          }
        )}`;
    }
  });

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

const queueTrackedChapters = (
  trackedSeries: ClaimedTrackedSeries,
  newChapters: SourceChapter[]
) =>
  Effect.gen(function* queueTrackedChaptersEffect() {
    const sql = yield* SqlClient.SqlClient;

    if (!trackedSeries.downloadDestinationId) {
      throw new Error("Tracked auto-download is missing a destination.");
    }

    const chapterExternalIds = newChapters.map((item) => item.externalId);
    const storedChapters = yield* decodeRows(
      Schema.Struct({
        id: chapterRow.fields.id,
        external_id: chapterRow.fields.external_id,
        is_downloaded: chapterRow.fields.is_downloaded,
      }),
      yield* sql`SELECT ${column(chapterColumns, "id")},
          ${column(chapterColumns, "externalId")},
          ${column(chapterColumns, "isDownloaded")}
        FROM ${table("chapter")}
        WHERE ${column(chapterColumns, "seriesId")} = ${trackedSeries.seriesRecordId}
          AND ${column(chapterColumns, "externalId")} IN ${sql.in(chapterExternalIds)}`
    );

    const storedChapterIds = storedChapters.map((item) => item.id);
    const activeJobs = storedChapterIds.length
      ? yield* decodeRows(
          Schema.Struct({
            chapter_id: downloadJobRow.fields.chapter_id,
          }),
          yield* sql`SELECT ${column(downloadJobColumns, "chapterId")} FROM ${table("downloadJob")}
            WHERE ${column(downloadJobColumns, "userId")} = ${trackedSeries.userId}
              AND ${column(downloadJobColumns, "chapterId")} IN ${sql.in(storedChapterIds)}
              AND ${column(downloadJobColumns, "status")} IN ${sql.in(activeDownloadJobStatuses)}`
        )
      : [];

    const activeChapterIds = new Set(
      activeJobs
        .map((item) => item.chapter_id)
        .filter((chapterId): chapterId is string => Boolean(chapterId))
    );
    const chaptersByExternalId = new Map(
      storedChapters.map((item) => [item.external_id, item])
    );

    const queueableChapters = [...newChapters]
      .reverse()
      .map((item) => chaptersByExternalId.get(item.externalId))
      .filter(
        (
          item
        ): item is {
          id: string;
          external_id: string;
          is_downloaded: boolean;
        } => {
          if (!item) {
            return false;
          }

          return !(item.is_downloaded || activeChapterIds.has(item.id));
        }
      );

    if (queueableChapters.length === 0) {
      return 0;
    }

    yield* sql`INSERT INTO ${table("downloadJob")} ${insertRow(
      sql,
      downloadJobColumns,
      queueableChapters.map((item) => ({
        id: crypto.randomUUID(),
        chapterId: item.id,
        downloadDestinationId: trackedSeries.downloadDestinationId,
        progressPercent: 0,
        seriesId: trackedSeries.seriesRecordId,
        userId: trackedSeries.userId,
      }))
    )}`;

    return queueableChapters.length;
  });

const completeTrackedSeriesCheck = (
  trackedSeries: ClaimedTrackedSeries,
  latestChapterExternalId: string | null,
  notificationBody: string | null
) =>
  Effect.gen(function* completeTrackedSeriesCheckEffect() {
    const sql = yield* SqlClient.SqlClient;
    const now = new Date();

    yield* sql.withTransaction(
      Effect.gen(function* completeCheck() {
        yield* sql`UPDATE ${table("trackedSeriesState")} SET ${updateRow(
          sql,
          trackedSeriesStateColumns,
          {
            checkFailureCount: 0,
            lastCheckedAt: now,
            lastSeenChapterExternalId:
              latestChapterExternalId ??
              trackedSeries.lastSeenChapterExternalId,
            nextCheckAt: getNextCheckAt(),
            updatedAt: now,
          }
        )}
          WHERE ${column(trackedSeriesStateColumns, "id")} = ${trackedSeries.id}`;

        if (notificationBody) {
          yield* queueNotification({
            body: notificationBody,
            title: buildTrackedSeriesTitle(trackedSeries.seriesTitle),
            type: "trackedSeriesUpdated",
            userId: trackedSeries.userId,
          });
        }
      })
    );
  });

export const claimDueTrackedSeries =
  async (): Promise<ClaimedTrackedSeries | null> => {
    const provisionalNextCheckAt = getNextCheckAt();
    const trackedStateId = await runSql(
      Effect.gen(function* claimDueTrackedSeriesEffect() {
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql<{ id: string }>`
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
        `;

        return rows[0]?.id ?? null;
      })
    );

    if (!trackedStateId) {
      return null;
    }

    const trackedSeries = await runSql(
      Effect.gen(function* loadClaimedTrackedSeries() {
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* decodeRows(
          claimedTrackedSeriesProjection,
          yield* sql`SELECT ${table("libraryEntry")}.${column(libraryEntryColumns, "autoDownload")} AS ${sql("autoDownload")},
              ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "checkFailureCount")} AS ${sql("checkFailureCount")},
              ${table("libraryEntry")}.${column(libraryEntryColumns, "downloadDestinationId")} AS ${sql("downloadDestinationId")},
              ${table("downloadDestination")}.${column(downloadDestinationColumns, "name")} AS ${sql("downloadDestinationName")},
              ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "id")} AS ${sql("id")},
              ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "lastSeenChapterExternalId")} AS ${sql("lastSeenChapterExternalId")},
              ${table("libraryEntry")}.${column(libraryEntryColumns, "id")} AS ${sql("libraryEntryId")},
              ${table("series")}.${column(seriesColumns, "externalId")} AS ${sql("seriesExternalId")},
              ${table("series")}.${column(seriesColumns, "id")} AS ${sql("seriesRecordId")},
              ${table("series")}.${column(seriesColumns, "sourceId")} AS ${sql("seriesSourceId")},
              ${table("series")}.${column(seriesColumns, "title")} AS ${sql("seriesTitle")},
              ${table("libraryEntry")}.${column(libraryEntryColumns, "userId")} AS ${sql("userId")}
            FROM ${table("trackedSeriesState")}
            INNER JOIN ${table("libraryEntry")} ON ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "libraryEntryId")} = ${table("libraryEntry")}.${column(libraryEntryColumns, "id")}
            INNER JOIN ${table("series")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")}
            LEFT JOIN ${table("downloadDestination")} ON ${table("libraryEntry")}.${column(libraryEntryColumns, "downloadDestinationId")} = ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")}
            WHERE ${table("trackedSeriesState")}.${column(trackedSeriesStateColumns, "id")} = ${trackedStateId}
            LIMIT 1`
        );

        return rows[0] ?? null;
      })
    );

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
  await runSql(upsertTrackedChapters(trackedSeries.seriesRecordId, chapters));

  const latestChapterExternalId =
    chapters[0]?.externalId ?? trackedSeries.lastSeenChapterExternalId;
  const newChapters = collectNewChapters(
    chapters,
    trackedSeries.lastSeenChapterExternalId
  );

  let notificationBody: string | null = null;

  if (newChapters.length > 0) {
    if (trackedSeries.autoDownload) {
      const queuedCount = await runSql(
        queueTrackedChapters(trackedSeries, newChapters)
      );

      if (queuedCount > 0) {
        notificationBody = `${queuedCount} new ${pluralize(queuedCount, "chapter", "chapters")} queued${trackedSeries.downloadDestinationName ? ` to ${trackedSeries.downloadDestinationName}` : ""}.`;
      }
    } else {
      notificationBody = `${newChapters.length} new ${pluralize(newChapters.length, "chapter", "chapters")} found. Auto-download is off.`;
    }
  }

  await runSql(
    completeTrackedSeriesCheck(
      trackedSeries,
      latestChapterExternalId,
      notificationBody
    )
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

  await runSql(
    Effect.gen(function* failTrackedSeriesEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.withTransaction(
        Effect.gen(function* failTrackedSeriesCheck() {
          yield* sql`UPDATE ${table("trackedSeriesState")} SET ${updateRow(
            sql,
            trackedSeriesStateColumns,
            {
              checkFailureCount: nextFailureCount,
              nextCheckAt: getNextCheckAt(2 ** Math.min(nextFailureCount, 4)),
              updatedAt: new Date(),
            }
          )}
            WHERE ${column(trackedSeriesStateColumns, "id")} = ${trackedSeries.id}`;

          if (shouldNotify) {
            yield* queueNotification({
              body: `Tracking check failed. ${message}`,
              title: buildTrackedSeriesTitle(trackedSeries.seriesTitle),
              type: "systemWarning",
              userId: trackedSeries.userId,
            });
          }
        })
      );
    })
  );
};
