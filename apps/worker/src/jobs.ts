import {
  column,
  decodeRows,
  insertRow,
  runSql,
  table,
  updateRow,
} from "@mangy/db";
import type { ChapterId } from "@mangy/db/model";
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
import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { queueNotification } from "./notifications";

export interface ClaimedDownloadJob {
  attempts: number;
  chapterExternalId: Option.Option<string>;
  chapterNumber: Option.Option<string>;
  chapterRecordId: Option.Option<ChapterId>;
  chapterTitle: Option.Option<string>;
  destinationKomgaLibraryId: Option.Option<string>;
  destinationName: Option.Option<string>;
  destinationPath: Option.Option<string>;
  id: string;
  maxAttempts: number;
  queueId: Option.Option<string>;
  seriesSourceId: Option.Option<string>;
  seriesTitle: Option.Option<string>;
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
  chapterExternalId: Schema.OptionFromNullOr(Chapter.fields.externalId),
  chapterNumber: Chapter.fields.chapterNumber,
  chapterRecordId: Schema.OptionFromNullOr(Chapter.fields.id),
  chapterTitle: Chapter.fields.title,
  destinationKomgaLibraryId: DownloadDestination.fields.komgaLibraryId,
  destinationName: Schema.OptionFromNullOr(DownloadDestination.fields.name),
  destinationPath: Schema.OptionFromNullOr(
    DownloadDestination.fields.absolutePath
  ),
  id: DownloadJob.fields.id,
  maxAttempts: DownloadJob.fields.maxAttempts,
  queueId: DownloadJob.fields.queueId,
  seriesSourceId: Schema.OptionFromNullOr(Series.fields.sourceId),
  seriesTitle: Schema.OptionFromNullOr(Series.fields.title),
  status: DownloadJob.fields.status,
  userId: DownloadJob.fields.userId,
});

const buildChapterLabel = (job: ClaimedDownloadJob): string => {
  const chapterNumber = Option.getOrUndefined(job.chapterNumber);
  const chapterTitle = Option.getOrUndefined(job.chapterTitle);

  if (chapterNumber !== undefined && chapterTitle !== undefined) {
    return `Chapter ${chapterNumber} - ${chapterTitle}`;
  }

  if (chapterNumber !== undefined) {
    return `Chapter ${chapterNumber}`;
  }

  return chapterTitle ?? "Special chapter";
};

const buildDownloadTitle = (job: ClaimedDownloadJob): string =>
  Option.getOrElse(job.seriesTitle, () => "Queued chapter");

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

          if (Option.isSome(job.chapterRecordId)) {
            const chapterRecordId = job.chapterRecordId.value;

            yield* sql`UPDATE ${table("chapter")} SET ${updateRow(
              sql,
              chapterColumns,
              {
                isDownloaded: true,
                updatedAt: now,
              }
            )}
              WHERE ${column(chapterColumns, "id")} = ${chapterRecordId}`;

            yield* sql`INSERT INTO ${table("downloadArtifact")} ${insertRow(
              sql,
              downloadArtifactColumns,
              {
                chapterId: chapterRecordId,
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
            body: `${chapterLabel} finished and was written to ${Option.getOrElse(job.destinationName, () => "your destination")}.`,
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
