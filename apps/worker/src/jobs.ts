import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import {
  Chapter,
  DownloadDestination,
  DownloadJob,
  Series,
  chapterColumns,
  downloadArtifactColumns,
  downloadDestinationColumns,
  downloadJobColumns,
  seriesColumns,
} from "@mangy/db/model";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { queueNotification } from "./notifications";

export interface ClaimedDownloadJob {
  attempts: number;
  chapterExternalId: string | null;
  chapterNumber: string | null;
  chapterRecordId: string | null;
  chapterTitle: string | null;
  destinationKomgaLibraryId: string | null;
  destinationName: string | null;
  destinationPath: string | null;
  id: string;
  maxAttempts: number;
  queueId: string | null;
  seriesSourceId: string | null;
  seriesTitle: string | null;
  status: Schema.Schema.Type<typeof DownloadJob.fields.status>;
  userId: string;
}

type ArtifactPackageFormat = "cbz" | "folder";

interface CompletedArtifact {
  fileSizeBytes: number;
  importedToKomgaAt?: Date | null;
  outputPath: string;
  packageFormat: ArtifactPackageFormat;
}

const claimedJobProjection = Schema.Struct({
  attempts: DownloadJob.fields.attempts,
  chapterExternalId: Schema.NullOr(Chapter.fields.externalId),
  chapterNumber: Schema.NullOr(Chapter.fields.chapterNumber),
  chapterRecordId: Schema.NullOr(Chapter.fields.id),
  chapterTitle: Schema.NullOr(Chapter.fields.title),
  destinationKomgaLibraryId: Schema.NullOr(
    DownloadDestination.fields.komgaLibraryId
  ),
  destinationName: Schema.NullOr(DownloadDestination.fields.name),
  destinationPath: Schema.NullOr(DownloadDestination.fields.absolutePath),
  id: DownloadJob.fields.id,
  maxAttempts: DownloadJob.fields.maxAttempts,
  queueId: DownloadJob.fields.queueId,
  seriesSourceId: Schema.NullOr(Series.fields.sourceId),
  seriesTitle: Schema.NullOr(Series.fields.title),
  status: DownloadJob.fields.status,
  userId: DownloadJob.fields.userId,
});

const buildChapterLabel = (job: ClaimedDownloadJob): string => {
  if (job.chapterNumber && job.chapterTitle) {
    return `Chapter ${job.chapterNumber} - ${job.chapterTitle}`;
  }

  if (job.chapterNumber) {
    return `Chapter ${job.chapterNumber}`;
  }

  return job.chapterTitle ?? "Special chapter";
};

const buildDownloadTitle = (job: ClaimedDownloadJob): string =>
  job.seriesTitle ?? "Queued chapter";

export const loadClaimedDownloadJob = (jobId: string) =>
  Effect.gen(function* loadClaimedDownloadJobEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      claimedJobProjection,
      yield* sql`SELECT ${table("downloadJob")}.${column(downloadJobColumns, "attempts")} AS ${sql("attempts")},
          ${table("chapter")}.${column(chapterColumns, "externalId")} AS ${sql("chapterExternalId")},
          ${table("chapter")}.${column(chapterColumns, "chapterNumber")} AS ${sql("chapterNumber")},
          ${table("chapter")}.${column(chapterColumns, "id")} AS ${sql("chapterRecordId")},
          ${table("chapter")}.${column(chapterColumns, "title")} AS ${sql("chapterTitle")},
          ${table("downloadDestination")}.${column(downloadDestinationColumns, "komgaLibraryId")} AS ${sql("destinationKomgaLibraryId")},
          ${table("downloadDestination")}.${column(downloadDestinationColumns, "name")} AS ${sql("destinationName")},
          ${table("downloadDestination")}.${column(downloadDestinationColumns, "absolutePath")} AS ${sql("destinationPath")},
          ${table("downloadJob")}.${column(downloadJobColumns, "id")} AS ${sql("id")},
          ${table("downloadJob")}.${column(downloadJobColumns, "maxAttempts")} AS ${sql("maxAttempts")},
          ${table("downloadJob")}.${column(downloadJobColumns, "queueId")} AS ${sql("queueId")},
          ${table("series")}.${column(seriesColumns, "sourceId")} AS ${sql("seriesSourceId")},
          ${table("series")}.${column(seriesColumns, "title")} AS ${sql("seriesTitle")},
          ${table("downloadJob")}.${column(downloadJobColumns, "status")} AS ${sql("status")},
          ${table("downloadJob")}.${column(downloadJobColumns, "userId")} AS ${sql("userId")}
        FROM ${table("downloadJob")}
        LEFT JOIN ${table("series")} ON ${table("downloadJob")}.${column(downloadJobColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")}
        LEFT JOIN ${table("chapter")} ON ${table("downloadJob")}.${column(downloadJobColumns, "chapterId")} = ${table("chapter")}.${column(chapterColumns, "id")}
        LEFT JOIN ${table("downloadDestination")} ON ${table("downloadJob")}.${column(downloadJobColumns, "downloadDestinationId")} = ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")}
        WHERE ${table("downloadJob")}.${column(downloadJobColumns, "id")} = ${jobId}
        LIMIT 1`
    );

    return rows[0] ?? null;
  });

export const updateDownloadJobProgress = async (
  jobId: string,
  progressPercent: number
): Promise<void> => {
  await runSql(
    Effect.gen(function* updateJobProgressEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
        sql,
        downloadJobColumns,
        {
          progressPercent: Math.max(0, Math.min(100, progressPercent)),
          updatedAt: new Date(),
        }
      )}
        WHERE ${column(downloadJobColumns, "id")} = ${jobId}`;
    })
  );
};

export const isDownloadJobCancelled = (jobId: string) =>
  Effect.gen(function* checkJobCancelledEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({ status: DownloadJob.fields.status }),
      yield* sql`SELECT ${column(downloadJobColumns, "status")} FROM ${table("downloadJob")}
        WHERE ${column(downloadJobColumns, "id")} = ${jobId}
        LIMIT 1`
    );

    return rows[0]?.status === "cancelled";
  });

export const completeDownloadJob = async (
  job: ClaimedDownloadJob,
  artifact: CompletedArtifact
): Promise<void> => {
  const now = new Date();
  const chapterLabel = buildChapterLabel(job);

  await runSql(
    Effect.gen(function* completeDownloadJobEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.withTransaction(
        Effect.gen(function* completeJob() {
          yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
            sql,
            downloadJobColumns,
            {
              completedAt: now,
              errorMessage: null,
              progressPercent: 100,
              queueId: null,
              status: "completed",
              updatedAt: now,
            }
          )}
            WHERE ${column(downloadJobColumns, "id")} = ${job.id}`;

          if (job.chapterRecordId) {
            yield* sql`UPDATE ${table("chapter")} SET ${updateRow(
              sql,
              chapterColumns,
              {
                isDownloaded: true,
                updatedAt: now,
              }
            )}
              WHERE ${column(chapterColumns, "id")} = ${job.chapterRecordId}`;

            yield* sql`INSERT INTO ${table("downloadArtifact")} ${insertRow(
              sql,
              downloadArtifactColumns,
              {
                chapterId: job.chapterRecordId,
                downloadJobId: job.id,
                fileSizeBytes: artifact.fileSizeBytes,
                id: crypto.randomUUID(),
                importedToKomgaAt: artifact.importedToKomgaAt ?? null,
                outputPath: artifact.outputPath,
                packageFormat: artifact.packageFormat,
              }
            )}`;
          }

          yield* queueNotification({
            body: `${chapterLabel} finished and was written to ${job.destinationName ?? "your destination"}.`,
            title: buildDownloadTitle(job),
            type: "downloadCompleted",
            userId: job.userId,
          });
        })
      );
    })
  );
};

export const failDownloadJob = async (
  job: ClaimedDownloadJob,
  error: unknown
): Promise<void> => {
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected download worker error.";
  const shouldNotify = job.attempts >= job.maxAttempts;

  await runSql(
    Effect.gen(function* failDownloadJobEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.withTransaction(
        Effect.gen(function* failJob() {
          yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
            sql,
            downloadJobColumns,
            {
              errorMessage: message,
              progressPercent: 0,
              status: "retryableFailed",
              updatedAt: new Date(),
            }
          )}
            WHERE ${column(downloadJobColumns, "id")} = ${job.id}`;

          if (shouldNotify) {
            yield* queueNotification({
              body: `${buildChapterLabel(job)} failed after ${job.attempts} attempts. ${message}`,
              title: buildDownloadTitle(job),
              type: "downloadFailed",
              userId: job.userId,
            });
          }
        })
      );
    })
  );
};
