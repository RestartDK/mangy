import { treaty } from "@elysiajs/eden";
import type { App } from "@server/index";

import { makeTrackingClient } from "../../../server/src/api/client";
import { getServerOrigin } from "./server-origin";

export const api = treaty<App>(getServerOrigin(), {
  fetch: {
    credentials: "include",
  },
});

export const tracking = makeTrackingClient(getServerOrigin());

export type {
  RefreshTrackedSeries,
  TrackedSeries,
} from "../../../server/src/api/tracking";
