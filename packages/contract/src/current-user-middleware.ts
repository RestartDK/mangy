import { HttpApiMiddleware } from "effect/http-api";

import { Unauthorized } from "./auth";
import type { CurrentUser } from "./current-user";

export class CurrentUserMiddleware extends HttpApiMiddleware.Service<
  CurrentUserMiddleware,
  { provides: CurrentUser }
>()("mangy/contract/CurrentUserMiddleware", { error: Unauthorized }) {}
