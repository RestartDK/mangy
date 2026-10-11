import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { Unauthorized } from "./auth";
import { isoDateTimeString } from "./timestamps";

export const liveSnapshotSchema = Schema.Struct({
  downloadsUpdatedAt: Schema.NullOr(isoDateTimeString),
  notificationsUnreadCount: Schema.Int,
  notificationsUpdatedAt: Schema.NullOr(isoDateTimeString),
  trackingUpdatedAt: Schema.NullOr(isoDateTimeString),
});
export type LiveSnapshot = typeof liveSnapshotSchema.Type;

const connectedEventSchema = Schema.Struct({
  data: Schema.fromJsonString(Schema.Struct({ snapshot: liveSnapshotSchema })),
  event: Schema.Literal("connected"),
});

const stateEventSchema = Schema.Struct({
  data: Schema.fromJsonString(
    Schema.Struct({
      downloadsChanged: Schema.Boolean,
      notificationsChanged: Schema.Boolean,
      snapshot: liveSnapshotSchema,
      trackingChanged: Schema.Boolean,
    })
  ),
  event: Schema.Literal("state"),
});

const heartbeatEventSchema = Schema.Struct({
  data: Schema.fromJsonString(Schema.Struct({ timestamp: Schema.Finite })),
  event: Schema.Literal("heartbeat"),
});

export const liveEventSchema = Schema.Union([
  connectedEventSchema,
  stateEventSchema,
  heartbeatEventSchema,
]);
export type LiveEvent = typeof liveEventSchema.Type;

export const LiveApi = HttpApiGroup.make("live")
  .add(
    HttpApiEndpoint.get("events", "/events", {
      error: [Unauthorized],
      success: HttpApiSchema.WithHeaders(
        HttpApiSchema.StreamSse({ events: liveEventSchema }),
        {
          "cache-control": Schema.String,
          connection: Schema.String,
        }
      ),
    })
  )
  .prefix("/api/live");
