import { BunRuntime } from "@effect/platform-bun";
import { env } from "@mangy/env";
import { Effect } from "effect";

import { claimNextDownloadJob, failDownloadJob } from "./jobs";
import {
  claimNextPushDelivery,
  failPushDelivery,
  processPushDelivery,
} from "./notifications";
import { CancelledError, runDownloadJob } from "./runner";
import {
  claimDueTrackedSeries,
  failTrackedSeries,
  processTrackedSeries,
} from "./tracking";

const sleep = (durationMs: number): Promise<void> => Bun.sleep(durationMs);

const workerHostname = Bun.env.HOSTNAME ?? Bun.env.HOST ?? "worker";
const workerId = `${workerHostname}-${Date.now()}-${crypto.randomUUID()}`;

const runWorkerLoop = async (): Promise<never> => {
  const pollIntervalMs = Number(env.WORKER_POLL_INTERVAL_MS);

  while (true) {
    const job = await claimNextDownloadJob(workerId);

    if (!job) {
      const trackedSeries = await claimDueTrackedSeries();

      if (!trackedSeries) {
        const pushDelivery = await claimNextPushDelivery(workerId);

        if (!pushDelivery) {
          await sleep(pollIntervalMs);
          continue;
        }

        try {
          await processPushDelivery(pushDelivery);
        } catch (error) {
          await failPushDelivery(pushDelivery, error);
        }

        continue;
      }

      try {
        await processTrackedSeries(trackedSeries);
      } catch (error) {
        await failTrackedSeries(trackedSeries, error);
      }

      continue;
    }

    try {
      await runDownloadJob(job);
    } catch (error) {
      if (error instanceof CancelledError) {
        continue;
      }

      await failDownloadJob(job, error);
    }
  }
};

const program = Effect.gen(function* () {
  yield* Effect.logInfo(`worker ${workerId} started`);

  yield* Effect.promise(() => runWorkerLoop());
});

BunRuntime.runMain(program);
