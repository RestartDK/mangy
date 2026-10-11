import { getAuth } from "@mangy/auth";
import { Unauthorized } from "@mangy/contract";
import { UserIdSchema } from "@mangy/db/model/ids";
import type { UserId } from "@mangy/db/model/ids";
import { Effect, Schema } from "effect";
import { HttpServerRequest } from "effect/http";

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

export const currentSessionUser: Effect.Effect<
  { email: string; id: UserId; name: string },
  Unauthorized,
  HttpServerRequest.HttpServerRequest
> = Effect.gen(function* currentSessionUserEffect() {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const session = yield* Effect.promise(
    async () =>
      await getAuth().api.getSession({ headers: new Headers(request.headers) })
  );
  if (!session?.user) {
    return yield* new Unauthorized({ message: "Unauthorized" });
  }

  return {
    email: session.user.email,
    id: yield* decodeUserId(session.user.id).pipe(Effect.orDie),
    name: session.user.name,
  };
});

export const currentUser: Effect.Effect<
  UserId,
  Unauthorized,
  HttpServerRequest.HttpServerRequest
> = currentSessionUser.pipe(Effect.map((user) => user.id));
