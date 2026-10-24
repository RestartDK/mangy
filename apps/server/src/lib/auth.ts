import { getAuth } from "@mangy/auth";
import {
  CurrentUser,
  CurrentUserMiddleware,
  Unauthorized,
} from "@mangy/contract";
import { UserIdSchema } from "@mangy/db/model/ids";
import { Effect, Layer, Schema } from "effect";
import { HttpServerRequest } from "effect/http";

const apiKeyHeader = "x-api-key";

interface RequestUser {
  email: string;
  id: string;
  name: string;
}

const decodeUserId = Schema.decodeUnknownEffect(UserIdSchema);

/**
 * Resolves the calling user from the better-auth session, which the api-key
 * plugin answers from a valid `x-api-key` header. A request that offers a key
 * is never downgraded to its cookie, so a stale key fails 401 instead of
 * quietly acting as the browser session that shares the header set.
 */
const resolveRequestUser = async (
  headers: Headers
): Promise<RequestUser | null> => {
  const session = await getAuth()
    .api.getSession({ headers })
    .catch((error: unknown) => {
      if (headers.has(apiKeyHeader)) {
        return null;
      }

      throw error;
    });

  if (!session?.user) {
    return null;
  }

  return {
    email: session.user.email,
    id: session.user.id,
    name: session.user.name,
  };
};

/**
 * Resolves the authenticated caller from a session cookie or an API key
 * @returns The user fields if authenticated, null otherwise
 */
export const getSessionUser = async (request: Request) =>
  await resolveRequestUser(request.headers);

export const CurrentUserMiddlewareLayer = Layer.succeed(
  CurrentUserMiddleware,
  CurrentUserMiddleware.of(
    Effect.fn(function* authenticateRequest(httpEffect) {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const user = yield* Effect.promise(
        async () => await resolveRequestUser(new Headers(request.headers))
      );

      if (user === null) {
        return yield* new Unauthorized({ message: "Unauthorized" });
      }

      const id = yield* decodeUserId(user.id).pipe(Effect.orDie);

      return yield* Effect.provideService(httpEffect, CurrentUser, {
        email: user.email,
        id,
        name: user.name,
      });
    })
  )
);
