import type { UserId } from "@mangy/db/model/ids";
import { Context } from "effect";

export class CurrentUser extends Context.Service<
  CurrentUser,
  { id: UserId; email: string; name: string }
>()("mangy/contract/CurrentUser") {}
