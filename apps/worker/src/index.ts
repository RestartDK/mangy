import { env } from "@mangy/env";

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const runWorkerLoop = async (): Promise<never> => {
  const pollIntervalMs = Number(env.WORKER_POLL_INTERVAL_MS);

  while (true) {
    await sleep(pollIntervalMs);
  }
};

void (async () => {
  await runWorkerLoop();
})();
