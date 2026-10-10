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
  seriesColumns,
  seriesRow,
} from "@mangy/db/model";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

import { SourcesService } from "../sources/service";
import { SourcesStorage } from "../sources/storage";

const activeJobStatuses = ["queued", "running", "retryableFailed"] as const;

const jobProjection = Schema.Struct({
  attempts: downloadJobRow.fields.attempts,
  chapterId: Schema.NullOr(chapterRow.fields.external_id),
  chapterTitle: Schema.NullOr(chapterRow.fields.title),
  completedAt: downloadJobRow.fields.completed_at,
  createdAt: downloadJobRow.fields.created_at,
  destinationName: Schema.NullOr(downloadDestinationRow.fields.name),
  errorMessage: downloadJobRow.fields.error_message,
  id: downloadJobRow.fields.id,
  maxAttempts: downloadJobRow.fields.max_attempts,
  progressPercent: downloadJobRow.fields.progress_percent,
  seriesId: Schema.NullOr(seriesRow.fields.external_id),
  seriesTitle: Schema.NullOr(seriesRow.fields.title),
  sourceId: Schema.NullOr(seriesRow.fields.source_id),
  status: downloadJobRow.fields.status,
  updatedAt: downloadJobRow.fields.updated_at,
});

type DownloadJob = Schema.Schema.Type<typeof jobProjection>;

const serializeJob = (row: DownloadJob) => ({
  ...row,
  completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const jobColumns = (sql: SqlClient.SqlClient) =>
  sql.csv([
    sql`${table("downloadJob")}.${column(downloadJobColumns, "id")} AS ${sql("id")}`,
    sql`${table("series")}.${column(seriesColumns, "sourceId")} AS ${sql("sourceId")}`,
    sql`${table("series")}.${column(seriesColumns, "externalId")} AS ${sql("seriesId")}`,
    sql`${table("chapter")}.${column(chapterColumns, "externalId")} AS ${sql("chapterId")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "status")} AS ${sql("status")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "progressPercent")} AS ${sql("progressPercent")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "attempts")} AS ${sql("attempts")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "maxAttempts")} AS ${sql("maxAttempts")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "errorMessage")} AS ${sql("errorMessage")}`,
    sql`${table("series")}.${column(seriesColumns, "title")} AS ${sql("seriesTitle")}`,
    sql`${table("chapter")}.${column(chapterColumns, "title")} AS ${sql("chapterTitle")}`,
    sql`${table("downloadDestination")}.${column(downloadDestinationColumns, "name")} AS ${sql("destinationName")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "completedAt")} AS ${sql("completedAt")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "createdAt")} AS ${sql("createdAt")}`,
    sql`${table("downloadJob")}.${column(downloadJobColumns, "updatedAt")} AS ${sql("updatedAt")}`,
  ]);

const baseQuery = (
  sql: SqlClient.SqlClient,
  extra: readonly Fragment[]
) => sql`SELECT ${jobColumns(sql)}
  FROM ${table("downloadJob")}
  LEFT JOIN ${table("series")} ON ${table("downloadJob")}.${column(downloadJobColumns, "seriesId")} = ${table("series")}.${column(seriesColumns, "id")}
  LEFT JOIN ${table("chapter")} ON ${table("downloadJob")}.${column(downloadJobColumns, "chapterId")} = ${table("chapter")}.${column(chapterColumns, "id")}
  LEFT JOIN ${table("downloadDestination")} ON ${table("downloadJob")}.${column(downloadJobColumns, "downloadDestinationId")} = ${table("downloadDestination")}.${column(downloadDestinationColumns, "id")}
  WHERE ${sql.and(extra)}`;

const list = (userId: string) =>
  Effect.gen(function* listEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      jobProjection,
      yield* sql`${baseQuery(sql, [
        sql`${table("downloadJob")}.${column(downloadJobColumns, "userId")} = ${userId}`,
      ])}
        ORDER BY ${table("downloadJob")}.${column(downloadJobColumns, "createdAt")} DESC`
    );

    return rows.map(serializeJob);
  });

const getJob = (userId: string, jobId: string) =>
  Effect.gen(function* getJobEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      jobProjection,
      yield* sql`${baseQuery(sql, [
        sql`${table("downloadJob")}.${column(downloadJobColumns, "userId")} = ${userId}`,
        sql`${table("downloadJob")}.${column(downloadJobColumns, "id")} = ${jobId}`,
      ])}
        ORDER BY ${table("downloadJob")}.${column(downloadJobColumns, "createdAt")} DESC
        LIMIT 1`
    );

    return rows[0] ?? null;
  });

const resolveDestination = (
  userId: string,
  requestedDestinationId: string | undefined
) =>
  Effect.gen(function* resolveDestinationEffect() {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* decodeRows(
      Schema.Struct({
        id: downloadDestinationRow.fields.id,
        isDefault: downloadDestinationRow.fields.is_default,
        isEnabled: downloadDestinationRow.fields.is_enabled,
      }),
      yield* sql`SELECT ${column(downloadDestinationColumns, "id")} AS ${sql("id")},
          ${column(downloadDestinationColumns, "isDefault")} AS ${sql("isDefault")},
          ${column(downloadDestinationColumns, "isEnabled")} AS ${sql("isEnabled")}
        FROM ${table("downloadDestination")}
        WHERE ${column(downloadDestinationColumns, "userId")} = ${userId}`
    );

    const enabledDestinations = rows.filter(
      (destination) => destination.isEnabled
    );

    if (enabledDestinations.length === 0) {
      throw new Error(
        "Add an enabled download destination in Settings before queueing chapters."
      );
    }

    if (requestedDestinationId) {
      const explicitDestination = enabledDestinations.find(
        (destination) => destination.id === requestedDestinationId
      );

      if (!explicitDestination) {
        throw new Error("The selected destination is missing or disabled.");
      }

      return explicitDestination;
    }

    const defaultDestination =
      enabledDestinations.find((destination) => destination.isDefault) ??
      enabledDestinations[0];

    if (!defaultDestination) {
      throw new Error("No destination is available for this download.");
    }

    return defaultDestination;
  });

const enqueue = (
  userId: string,
  input: {
    sourceId: string;
    seriesId: string;
    chapterId: string;
    downloadDestinationId?: string;
  }
) =>
  Effect.gen(function* enqueueEffect() {
    const sql = yield* SqlClient.SqlClient;
    const adapter = SourcesService.getSourceOrThrow(input.sourceId);
    const seriesItem = yield* Effect.promise(() =>
      adapter.getSeries(input.seriesId)
    );
    const seriesRecord = yield* Effect.promise(() =>
      SourcesStorage.upsertSeriesItem(input.sourceId, seriesItem)
    );

    const chapters = yield* Effect.promise(() =>
      adapter.getChapters(input.seriesId)
    );
    yield* Effect.promise(() =>
      SourcesStorage.upsertChapters(seriesRecord.id, chapters)
    );

    const chapterRows = yield* decodeRows(
      Schema.Struct({ id: chapterRow.fields.id }),
      yield* sql`SELECT ${column(chapterColumns, "id")} FROM ${table("chapter")}
        WHERE ${column(chapterColumns, "seriesId")} = ${seriesRecord.id}
          AND ${column(chapterColumns, "externalId")} = ${input.chapterId}`
    );

    const [chapterRecord] = chapterRows;
    if (!chapterRecord) {
      throw new Error(
        "This chapter is no longer available from the selected source."
      );
    }

    const destination = yield* resolveDestination(
      userId,
      input.downloadDestinationId
    );

    const existingJobs = yield* decodeRows(
      Schema.Struct({ id: downloadJobRow.fields.id }),
      yield* sql`SELECT ${column(downloadJobColumns, "id")} FROM ${table("downloadJob")}
        WHERE ${column(downloadJobColumns, "userId")} = ${userId}
          AND ${column(downloadJobColumns, "chapterId")} = ${chapterRecord.id}
          AND ${column(downloadJobColumns, "status")} IN ${sql.in(activeJobStatuses)}
        LIMIT 1`
    );

    const [existingJob] = existingJobs;
    if (existingJob) {
      const job = yield* getJob(userId, existingJob.id);
      if (!job) {
        throw new Error("The existing queued job could not be loaded.");
      }

      return serializeJob(job);
    }

    const createdJob = yield* sql.withTransaction(
      Effect.gen(function* createJob() {
        yield* sql`INSERT INTO ${table("libraryEntry")} ${insertRow(
          sql,
          libraryEntryColumns,
          {
            id: crypto.randomUUID(),
            downloadDestinationId: destination.id,
            seriesId: seriesRecord.id,
            userId,
          }
        )}
          ON CONFLICT (${column(libraryEntryColumns, "userId")}, ${column(libraryEntryColumns, "seriesId")}) DO UPDATE SET ${updateRow(
            sql,
            libraryEntryColumns,
            {
              downloadDestinationId: destination.id,
              updatedAt: new Date(),
            }
          )}`;

        const rows = yield* decodeRows(
          Schema.Struct({ id: downloadJobRow.fields.id }),
          yield* sql`INSERT INTO ${table("downloadJob")} ${insertRow(
            sql,
            downloadJobColumns,
            {
              id: crypto.randomUUID(),
              chapterId: chapterRecord.id,
              downloadDestinationId: destination.id,
              progressPercent: 0,
              seriesId: seriesRecord.id,
              userId,
            }
          )}
            RETURNING ${column(downloadJobColumns, "id")}`
        );

        return rows[0] ?? null;
      })
    );

    if (!createdJob) {
      throw new Error("Unable to create a queue job for this chapter.");
    }

    const job = yield* getJob(userId, createdJob.id);
    if (!job) {
      throw new Error("The queued download could not be loaded.");
    }

    return serializeJob(job);
  });

const cancel = (userId: string, jobId: string) =>
  Effect.gen(function* cancelEffect() {
    const sql = yield* SqlClient.SqlClient;
    const job = yield* getJob(userId, jobId);
    if (!job) {
      throw new Error("The requested queue job could not be found.");
    }

    if (job.status === "completed") {
      throw new Error("Completed jobs cannot be cancelled.");
    }

    if (job.status === "cancelled") {
      return serializeJob(job);
    }

    yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
      sql,
      downloadJobColumns,
      {
        completedAt: null,
        errorMessage: null,
        leaseOwner: null,
        leasedAt: null,
        status: "cancelled",
        updatedAt: new Date(),
      }
    )}
      WHERE ${column(downloadJobColumns, "userId")} = ${userId}
        AND ${column(downloadJobColumns, "id")} = ${jobId}`;

    const updatedJob = yield* getJob(userId, jobId);
    if (!updatedJob) {
      throw new Error("The cancelled queue job could not be loaded.");
    }

    return serializeJob(updatedJob);
  });

const retry = (userId: string, jobId: string) =>
  Effect.gen(function* retryEffect() {
    const sql = yield* SqlClient.SqlClient;
    const job = yield* getJob(userId, jobId);
    if (!job) {
      throw new Error("The requested queue job could not be found.");
    }

    if (!(job.status === "retryableFailed" || job.status === "cancelled")) {
      throw new Error("Only failed or cancelled jobs can be retried.");
    }

    const now = new Date();

    yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
      sql,
      downloadJobColumns,
      {
        attempts: 0,
        completedAt: null,
        createdAt: now,
        errorMessage: null,
        leaseOwner: null,
        leasedAt: null,
        progressPercent: 0,
        startedAt: null,
        status: "queued",
        updatedAt: now,
      }
    )}
      WHERE ${column(downloadJobColumns, "userId")} = ${userId}
        AND ${column(downloadJobColumns, "id")} = ${jobId}`;

    const updatedJob = yield* getJob(userId, jobId);
    if (!updatedJob) {
      throw new Error("The retried queue job could not be loaded.");
    }

    return serializeJob(updatedJob);
  });

const prioritize = (userId: string, jobId: string) =>
  Effect.gen(function* prioritizeEffect() {
    const sql = yield* SqlClient.SqlClient;
    const job = yield* getJob(userId, jobId);
    if (!job) {
      throw new Error("The requested queue job could not be found.");
    }

    if (!(job.status === "queued" || job.status === "retryableFailed")) {
      throw new Error("Only queued jobs can be moved to the front.");
    }

    const earliestJobs = yield* decodeRows(
      Schema.Struct({ created_at: downloadJobRow.fields.created_at }),
      yield* sql`SELECT ${column(downloadJobColumns, "createdAt")} FROM ${table("downloadJob")}
        WHERE ${column(downloadJobColumns, "userId")} = ${userId}
          AND ${column(downloadJobColumns, "status")} IN ${sql.in(activeJobStatuses)}
        ORDER BY ${column(downloadJobColumns, "createdAt")} ASC
        LIMIT 1`
    );

    const [earliestJob] = earliestJobs;
    const createdAt = earliestJob
      ? new Date(earliestJob.created_at.getTime() - 1000)
      : new Date(Date.now() - 1000);

    yield* sql`UPDATE ${table("downloadJob")} SET ${updateRow(
      sql,
      downloadJobColumns,
      {
        createdAt,
        updatedAt: new Date(),
      }
    )}
      WHERE ${column(downloadJobColumns, "userId")} = ${userId}
        AND ${column(downloadJobColumns, "id")} = ${jobId}`;

    const updatedJob = yield* getJob(userId, jobId);
    if (!updatedJob) {
      throw new Error("The reordered queue job could not be loaded.");
    }

    return serializeJob(updatedJob);
  });

export const DownloadsService = {
  async list(userId: string) {
    return await runSql(list(userId));
  },

  async getJob(userId: string, jobId: string) {
    const job = await runSql(getJob(userId, jobId));

    return job ?? null;
  },

  async enqueue(
    userId: string,
    input: {
      sourceId: string;
      seriesId: string;
      chapterId: string;
      downloadDestinationId?: string;
    }
  ) {
    return await runSql(enqueue(userId, input));
  },

  async cancel(userId: string, jobId: string) {
    return await runSql(cancel(userId, jobId));
  },

  async retry(userId: string, jobId: string) {
    return await runSql(retry(userId, jobId));
  },

  async prioritize(userId: string, jobId: string) {
    return await runSql(prioritize(userId, jobId));
  },
};
