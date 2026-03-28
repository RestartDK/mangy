import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { env } from "@mangy/env";

import { claimNextDownloadJob, failDownloadJob } from "./jobs";
import { CancelledError, runDownloadJob } from "./runner";
import {
  claimDueTrackedSeries,
  failTrackedSeries,
  processTrackedSeries,
} from "./tracking";

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const workerId = `${hostname()}-${process.pid}-${randomUUID()}`;

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

await runWorkerLoop();
