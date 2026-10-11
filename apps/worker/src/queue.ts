import { column, decodeRows, runSql, table } from "@mangy/db";
import { DownloadJob, downloadJobColumns } from "@mangy/db/model";
import { Data, Duration, Effect, Layer, Schedule, Schema } from "effect";
import { PersistedQueue } from "effect/persistence";
import { SqlClient } from "effect/sql";

import {
  failDownloadJob,
  isDownloadJobCancelled,
  loadClaimedDownloadJob,
} from "./jobs";
import type { ClaimedDownloadJob } from "./jobs";
import { runDownloadJob } from "./runner";

const downloadQueueElement = Schema.Struct({ jobId: Schema.String });
type DownloadQueueElement = Schema.Schema.Type<typeof downloadQueueElement>;
type DownloadQueue = PersistedQueue.PersistedQueue<DownloadQueueElement>;

const downloadMaxAttempts = 3;
const cancellationPollInterval = Duration.seconds(2);

class DownloadRunFailed extends Data.TaggedError("DownloadRunFailed")<{
  readonly cause: unknown;
}> {}

export const downloadQueueLayer = PersistedQueue.layer.pipe(
  Layer.provide(
    PersistedQueue.layerStoreSql({
      pollInterval: Duration.millis(250),
      tableName: "download_queue",
    })
  )
);

export const makeDownloadQueue = PersistedQueue.make({
  maxAttempts: downloadMaxAttempts,
  name: "downloads",
  retrySchedule: Schedule.exponential("30 seconds"),
  schema: downloadQueueElement,
});

const markDownloadJobRunning = (jobId: string, attempts: number) =>
  Effect.gen(function* markDownloadJobRunningEffect() {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE ${table("downloadJob")} SET
        ${column(downloadJobColumns, "status")} = ${"running"},
        ${column(downloadJobColumns, "attempts")} = ${attempts},
        ${column(downloadJobColumns, "errorMessage")} = ${null},
        ${column(downloadJobColumns, "startedAt")} = coalesce(${column(downloadJobColumns, "startedAt")}, now()),
        ${column(downloadJobColumns, "updatedAt")} = now()
      WHERE ${column(downloadJobColumns, "id")} = ${jobId}`;
  });

const watchForCancellation = (jobId: string, cancelled: { value: boolean }) =>
  isDownloadJobCancelled(jobId).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(cancellationPollInterval),
      until: (value) => value,
    }),
    Effect.tap(() =>
      Effect.sync(() => {
        cancelled.value = true;
      })
    ),
    Effect.asVoid
  );

const runClaimedDownload = (claimed: ClaimedDownloadJob) =>
  Effect.gen(function* runClaimedDownloadEffect() {
    yield* markDownloadJobRunning(claimed.id, claimed.attempts);

    const cancelled = { value: false };
    yield* watchForCancellation(claimed.id, cancelled).pipe(Effect.forkChild);

    yield* runDownloadJob(claimed, () => cancelled.value).pipe(
      Effect.catchTag("CancelledError", () => Effect.interrupt),
      Effect.tapError((error) =>
        Effect.tryPromise({
          catch: (cause) => new DownloadRunFailed({ cause }),
          try: async () => {
            await failDownloadJob(claimed, error);
          },
        }).pipe(Effect.ignoreCause)
      )
    );

    return claimed;
  });

const takeNextDownload = (
  value: DownloadQueueElement,
  metadata: { attempts: number; id: string }
) =>
  Effect.gen(function* takeNextDownloadEffect() {
    const claimed = yield* loadClaimedDownloadJob(value.jobId);
    if (
      !claimed ||
      claimed.queueId !== metadata.id ||
      claimed.status === "cancelled" ||
      claimed.status === "completed"
    ) {
      return null;
    }

    return yield* runClaimedDownload(claimed);
  });

export const reconcileQueuedDownloadJobs = (queue: DownloadQueue) =>
  Effect.gen(function* reconcileQueuedDownloadJobsEffect() {
    const sql = yield* SqlClient.SqlClient;
    const queued = yield* decodeRows(
      Schema.Struct({
        id: DownloadJob.fields.id,
        queueId: DownloadJob.fields.queueId,
      }),
      yield* sql`SELECT ${column(downloadJobColumns, "id")} AS ${sql("id")},
          ${column(downloadJobColumns, "queueId")} AS ${sql("queueId")}
        FROM ${table("downloadJob")}
        WHERE ${column(downloadJobColumns, "status")} = ${"queued"}
        ORDER BY ${column(downloadJobColumns, "createdAt")} ASC, ${column(downloadJobColumns, "id")} ASC`
    );

    for (const { id, queueId: existingQueueId } of queued) {
      let queueId = existingQueueId;
      if (queueId === null) {
        const generated = crypto.randomUUID();
        const updated = yield* decodeRows(
          Schema.Struct({ id: DownloadJob.fields.id }),
          yield* sql`UPDATE ${table("downloadJob")}
            SET ${column(downloadJobColumns, "queueId")} = ${generated},
                ${column(downloadJobColumns, "updatedAt")} = now()
            WHERE ${column(downloadJobColumns, "id")} = ${id}
              AND ${column(downloadJobColumns, "status")} = ${"queued"}
              AND ${column(downloadJobColumns, "queueId")} IS NULL
            RETURNING ${column(downloadJobColumns, "id")}`
        );

        if (updated.length === 0) {
          continue;
        }

        queueId = generated;
      }

      yield* queue
        .offer({ jobId: id }, { id: queueId })
        .pipe(Effect.ignoreCause);
    }
  });

export const consumeDownloadQueue = Effect.gen(function* consumeQueueEffect() {
  const queue = yield* makeDownloadQueue;
  return yield* Effect.forever(
    queue
      .take((value, metadata) => takeNextDownload(value, metadata))
      .pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("Download job processing failed", cause)
        )
      )
  );
});

export const processNextDownloadJob = async (
  _workerId: string
): Promise<ClaimedDownloadJob | null> => {
  const program = Effect.gen(function* processNextDownloadJobEffect() {
    const queue = yield* makeDownloadQueue;
    yield* reconcileQueuedDownloadJobs(queue);

    while (true) {
      const claimed = yield* queue.take((value, metadata) =>
        takeNextDownload(value, metadata)
      );

      if (claimed) {
        return claimed;
      }
    }
  });

  return await runSql(program.pipe(Effect.provide(downloadQueueLayer)));
};
