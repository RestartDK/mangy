import { Api } from "@mangy/contract";
import type { LiveEvent, LiveSnapshot } from "@mangy/contract";
import { Duration, Effect, Schedule, Stream } from "effect";
import { HttpApiBuilder, HttpApiSchema } from "effect/http-api";

import { currentUser } from "@/lib/auth";

import { hasSnapshotChanged, LiveService } from "./service";

const pollInterval = Duration.millis(1500);
export const heartbeatIntervalSeconds = 15;
const heartbeatInterval = Duration.seconds(heartbeatIntervalSeconds);

const stateEvent = (previous: LiveSnapshot, next: LiveSnapshot): LiveEvent => ({
  data: {
    downloadsChanged: next.downloadsUpdatedAt !== previous.downloadsUpdatedAt,
    notificationsChanged:
      next.notificationsUpdatedAt !== previous.notificationsUpdatedAt ||
      next.notificationsUnreadCount !== previous.notificationsUnreadCount,
    snapshot: next,
    trackingChanged: next.trackingUpdatedAt !== previous.trackingUpdatedAt,
  },
  event: "state",
});

const snapshotPoll = (userId: string, initial: LiveSnapshot) =>
  Stream.fromSchedule(Schedule.spaced(pollInterval)).pipe(
    Stream.mapAccumEffect(
      () => initial,
      (previous) =>
        Effect.gen(function* poll() {
          const next = yield* Effect.promise(
            async () => await LiveService.loadSnapshot(userId)
          );

          return hasSnapshotChanged(previous, next)
            ? ([next, [stateEvent(previous, next)]] as const)
            : ([previous, []] as const);
        })
    )
  );

const heartbeat = Stream.fromSchedule(Schedule.spaced(heartbeatInterval)).pipe(
  Stream.map((): LiveEvent => ({
    data: { timestamp: Date.now() },
    event: "heartbeat",
  }))
);

const liveEvents = (userId: string, initial: LiveSnapshot) =>
  Stream.concat(
    Stream.make({
      data: { snapshot: initial },
      event: "connected",
    } satisfies LiveEvent),
    Stream.merge(snapshotPoll(userId, initial), heartbeat)
  ).pipe(Stream.catchCause(() => Stream.empty));

export const LiveApiLive = HttpApiBuilder.group(Api, "live", (handlers) =>
  handlers.handleAll({
    events: Effect.fn(function* eventsHandler() {
      const userId = yield* currentUser;
      const initialSnapshot = yield* Effect.promise(
        async () => await LiveService.loadSnapshot(userId)
      );

      return HttpApiSchema.withHeaders({
        body: liveEvents(userId, initialSnapshot),
        headers: {
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    }),
  })
);
