import { treaty } from "@elysiajs/eden";
import type { App } from "@server/index";

import { getServerOrigin } from "./server-origin";

export const api = treaty<App>(getServerOrigin(), {
  fetch: {
    credentials: "include",
  },
});
