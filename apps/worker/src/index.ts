declare const Bun: typeof import("bun");

import { env } from "@mangy/env";

import { claimNextDownloadJob, failDownloadJob } from "./jobs";
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
        await sleep(pollIntervalMs);
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

const main = async (): Promise<void> => {
  await runWorkerLoop();
};

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);

  console.error(message);
  throw error;
}
