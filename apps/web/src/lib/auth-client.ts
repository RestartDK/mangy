import { createAuthClient } from "better-auth/react";

import { getServerOrigin } from "./server-origin";

export const authClient = createAuthClient({
  baseURL: getServerOrigin(),
});
