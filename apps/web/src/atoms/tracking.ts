import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";

export type { TrackedSeries } from "@mangy/contract";

export const trackingQuery = ApiAtoms.query("tracking", "list", {
  reactivityKeys: [reactivityKey.tracking],
});
