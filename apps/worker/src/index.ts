import { BunRuntime } from "@effect/platform-bun";
import { runSql } from "@mangy/db";
import { env } from "@mangy/env";
import { Duration, Effect, Schedule } from "effect";

import {
  claimNextPushDelivery,
  failPushDelivery,
  processPushDelivery,
} from "./notifications";
import {
  consumeDownloadQueue,
  downloadQueueLayer,
  makeDownloadQueue,
  reconcileQueuedDownloadJobs,
} from "./queue";
import {
  claimDueTrackedSeries,
  failTrackedSeries,
  processTrackedSeries,
} from "./tracking";

const workerHostname = Bun.env.HOSTNAME ?? Bun.env.HOST ?? "worker";
const workerId = `${workerHostname}-${Date.now()}-${crypto.randomUUID()}`;

const getPollInterval = (): Duration.Duration => {
  const intervalMs = Number(env.WORKER_POLL_INTERVAL_MS);

  return Duration.millis(
    Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 15_000
  );
};

const processTrackedSeriesOnce = async (): Promise<void> => {
  const trackedSeries = await claimDueTrackedSeries();
  if (!trackedSeries) {
    return;
  }

  try {
    await processTrackedSeries(trackedSeries);
  } catch (error) {
    await failTrackedSeries(trackedSeries, error);
  }
};

const processPushDeliveryOnce = async (): Promise<void> => {
  const pushDelivery = await claimNextPushDelivery(workerId);
  if (!pushDelivery) {
    return;
  }

  try {
    await processPushDelivery(pushDelivery);
  } catch (error) {
    await failPushDelivery(pushDelivery, error);
  }
};

const reconcileStep = Effect.gen(function* reconcileStepEffect() {
  const queue = yield* makeDownloadQueue;
  yield* reconcileQueuedDownloadJobs(queue);
  yield* Effect.promise(processTrackedSeriesOnce);
  yield* Effect.promise(processPushDeliveryOnce);
});

const program = Effect.gen(function* program() {
  yield* Effect.logInfo(`worker ${workerId} started`);

  yield* Effect.all(
    [
      consumeDownloadQueue,
      Effect.repeat(
        reconcileStep.pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("Worker poll failed", cause)
          )
        ),
        Schedule.spaced(getPollInterval())
      ),
    ],
    { concurrency: "unbounded" }
  );
});

BunRuntime.runMain(
  Effect.promise(async () => {
    await runSql(program.pipe(Effect.provide(downloadQueueLayer)));
  })
);
