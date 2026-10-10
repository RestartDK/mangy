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
  downloadArtifactColumns,
  downloadDestinationColumns,
  downloadDestinationRow,
  downloadJobColumns,
  downloadJobRow,
  seriesColumns,
  seriesRow,
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
  seriesSourceId: string | null;
  seriesTitle: string | null;
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
  attempts: downloadJobRow.fields.attempts,
  chapterExternalId: Schema.NullOr(chapterRow.fields.external_id),
  chapterNumber: Schema.NullOr(chapterRow.fields.chapter_number),
  chapterRecordId: Schema.NullOr(chapterRow.fields.id),
  chapterTitle: Schema.NullOr(chapterRow.fields.title),
  destinationKomgaLibraryId: Schema.NullOr(
    downloadDestinationRow.fields.komga_library_id
  ),
  destinationName: Schema.NullOr(downloadDestinationRow.fields.name),
  destinationPath: Schema.NullOr(downloadDestinationRow.fields.absolute_path),
  id: downloadJobRow.fields.id,
  maxAttempts: downloadJobRow.fields.max_attempts,
  seriesSourceId: Schema.NullOr(seriesRow.fields.source_id),
  seriesTitle: Schema.NullOr(seriesRow.fields.title),
  userId: downloadJobRow.fields.user_id,
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

export const claimNextDownloadJob = async (
  workerId: string
): Promise<ClaimedDownloadJob | null> => {
  const claimedJobId = await runSql(
    Effect.gen(function* claimDownloadJob() {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql<{ id: string }>`
        update "download_job"
        set
          "status" = 'running',
          "lease_owner" = ${workerId},
          "leased_at" = now(),
          "started_at" = coalesce("started_at", now()),
          "attempts" = "attempts" + 1,
          "error_message" = null,
          "updated_at" = now()
        where "id" = (
          select "id"
          from "download_job"
          where (
            "status" = 'queued'
            or (
              "status" = 'retryableFailed'
              and "attempts" < "max_attempts"
              and "updated_at" <= now() - (interval '15 seconds' * power(2, greatest("attempts", 0)))
            )
          )
          and (
            "lease_owner" is null
            or "leased_at" is null
            or "leased_at" <= now() - interval '10 minutes'
          )
          order by "created_at" asc
          for update skip locked
          limit 1
        )
        returning "id";
      `;

      return rows[0]?.id ?? null;
    })
  );

  if (!claimedJobId) {
    return null;
  }

  const job = await runSql(
    Effect.gen(function* loadClaimedJob() {
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
            ${table("series")}.${column(seriesColumns, "sourceId")} AS ${sql("seriesSourceId")},
            ${table("series")}.${column(seriesColumns, "title")} AS ${sql("seriesTitle")},
            ${table("downloadJob")}.${column(downloadJobColumns, "userId")} AS ${sql("userId")}
          FROM ${table("downloadJob")}
          LEFT JOIN ${table("series")} ON ${table("downloadJob")}.${column(downloadJobColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")}
          LEFT JOIN ${table("chapter")} ON ${table("downloadJob")}.${column(downloadJobColumns, "chapterId")} = ${table("chapter")}.${column(chapterColumns, "id")}
          LEFT JOIN ${table("downloadDestination")} ON ${table("downloadJob")}.${column(downloadJobColumns, "downloadDestinationId")} = ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")}
          WHERE ${table("downloadJob")}.${column(downloadJobColumns, "id")} = ${claimedJobId}
          LIMIT 1`
      );

      return rows[0] ?? null;
    })
  );

  return job ?? null;
};

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

export const isDownloadJobCancelled = async (
  jobId: string
): Promise<boolean> => {
  const status = await runSql(
    Effect.gen(function* checkJobCancelledEffect() {
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* decodeRows(
        Schema.Struct({ status: downloadJobRow.fields.status }),
        yield* sql`SELECT ${column(downloadJobColumns, "status")} FROM ${table("downloadJob")}
          WHERE ${column(downloadJobColumns, "id")} = ${jobId}
          LIMIT 1`
      );

      return rows[0]?.status ?? null;
    })
  );

  return status === "cancelled";
};

export const cancelRunningDownloadJob = async (
  jobId: string
): Promise<void> => {
  await runSql(
    Effect.gen(function* cancelJobLeaseEffect() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
        sql,
        downloadJobColumns,
        {
          completedAt: null,
          errorMessage: null,
          leaseOwner: null,
          leasedAt: null,
          updatedAt: new Date(),
        }
      )}
        WHERE ${column(downloadJobColumns, "id")} = ${jobId}
          AND ${column(downloadJobColumns, "status")} = ${"cancelled"}`;
    })
  );
};

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
              leaseOwner: null,
              leasedAt: null,
              progressPercent: 100,
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
              leaseOwner: null,
              leasedAt: null,
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
