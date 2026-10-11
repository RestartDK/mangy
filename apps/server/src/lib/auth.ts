import { getAuth } from "@mangy/auth";
import { UserIdSchema } from "@mangy/db/model/ids";
import type { UserId } from "@mangy/db/model/ids";
import { Effect, Schema } from "effect";
import { HttpServerRequest } from "effect/http";

import { Unauthorized } from "@/api/auth";

/**
 * Extracts the authenticated user from a request's session
 * @returns The user object if authenticated, null otherwise
 */
export const getSessionUser = async (request: Request) => {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) {
    return null;
  }
  return session.user;
};

const decodeUserId = Schema.decodeUnknownEffect(UserIdSchema);

export const currentUser: Effect.Effect<
  UserId,
  Unauthorized,
  HttpServerRequest.HttpServerRequest
> = Effect.gen(function* currentUserEffect() {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const session = yield* Effect.promise(
    async () =>
      await getAuth().api.getSession({ headers: new Headers(request.headers) })
  );
  if (!session?.user) {
    return yield* new Unauthorized({ message: "Unauthorized" });
  }

  return yield* decodeUserId(session.user.id).pipe(Effect.orDie);
});
