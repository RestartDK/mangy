import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { Unauthorized } from "./auth";
import { BadRequest } from "./errors";
import { DownloadDestinationIdSchema, KomgaLibraryIdSchema } from "./ids";
import { isoDateTimeString } from "./timestamps";

const trimmed = Schema.Trim;

const trimmedKomgaLibraryId = Schema.Trim.pipe(Schema.brand("KomgaLibraryId"));

export const destinationSchema = Schema.Struct({
  absolutePath: Schema.String,
  id: DownloadDestinationIdSchema,
  isDefault: Schema.Boolean,
  isEnabled: Schema.Boolean,
  komgaLibraryId: Schema.OptionFromNullOr(KomgaLibraryIdSchema),
  name: Schema.String,
});
export type Destination = typeof destinationSchema.Type;

export const destinationParamsSchema = Schema.Struct({
  destinationId: DownloadDestinationIdSchema,
});

export const deleteDestinationResponseSchema = Schema.Struct({
  id: DownloadDestinationIdSchema,
});

export const createDestinationBody = Schema.Struct({
  absolutePath: trimmed.check(Schema.isMinLength(1)),
  isDefault: Schema.optional(Schema.Boolean),
  komgaLibraryId: Schema.optional(trimmedKomgaLibraryId),
  name: trimmed.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});
export type CreateDestination = typeof createDestinationBody.Type;

export const profileSchema = Schema.Struct({
  email: Schema.String,
  name: Schema.String,
});

export const settingsBootstrapSchema = Schema.Struct({
  destinations: Schema.Array(destinationSchema),
  notifications: Schema.Struct({
    inAppEnabled: Schema.Boolean,
    unreadCount: Schema.Int,
  }),
  profile: profileSchema,
});
export type SettingsBootstrap = typeof settingsBootstrapSchema.Type;

export const browserPushSettingsSchema = Schema.Struct({
  activeSubscriptionCount: Schema.Int,
  isConfigured: Schema.Boolean,
  isEnabled: Schema.Boolean,
  lastDeliveredAt: Schema.OptionFromNullOr(isoDateTimeString),
  lastError: Schema.OptionFromNullOr(Schema.String),
  lastErrorAt: Schema.OptionFromNullOr(isoDateTimeString),
  notifyOnDownloadCompleted: Schema.Boolean,
  notifyOnDownloadFailed: Schema.Boolean,
  notifyOnSystemWarning: Schema.Boolean,
  notifyOnTrackedSeriesUpdate: Schema.Boolean,
  vapidPublicKey: Schema.NullOr(Schema.String),
});
export type PushSettings = typeof browserPushSettingsSchema.Type;

export const updateBrowserPushPreferencesBody = Schema.Struct({
  isEnabled: Schema.Boolean,
  notifyOnDownloadCompleted: Schema.Boolean,
  notifyOnDownloadFailed: Schema.Boolean,
  notifyOnSystemWarning: Schema.Boolean,
  notifyOnTrackedSeriesUpdate: Schema.Boolean,
});
export type UpdateBrowserPushPreferences =
  typeof updateBrowserPushPreferencesBody.Type;

export const savePushSubscriptionBody = Schema.Struct({
  endpoint: Schema.String,
  expirationTime: Schema.optional(Schema.NullOr(Schema.Finite)),
  keys: Schema.Struct({
    auth: trimmed.check(Schema.isMinLength(1)),
    p256dh: trimmed.check(Schema.isMinLength(1)),
  }),
  userAgent: Schema.optional(trimmed),
});
export type SavePushSubscription = typeof savePushSubscriptionBody.Type;

export const removePushSubscriptionBody = Schema.Struct({
  endpoint: Schema.String,
});
export type RemovePushSubscription = typeof removePushSubscriptionBody.Type;

export const browserPushTestResponseSchema = Schema.Struct({
  deliveredCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const SettingsApi = HttpApiGroup.make("settings")
  .add(
    HttpApiEndpoint.get("bootstrap", "/bootstrap", {
      error: [Unauthorized],
      success: settingsBootstrapSchema,
    }),
    HttpApiEndpoint.get("getPush", "/push", {
      error: [Unauthorized],
      success: browserPushSettingsSchema,
    }),
    HttpApiEndpoint.patch("updatePushPreferences", "/push/preferences", {
      error: [Unauthorized, BadRequest],
      payload: updateBrowserPushPreferencesBody,
      success: browserPushSettingsSchema,
    }),
    HttpApiEndpoint.post("savePushSubscription", "/push/subscriptions", {
      error: [Unauthorized, BadRequest],
      payload: savePushSubscriptionBody,
      success: browserPushSettingsSchema,
    }),
    HttpApiEndpoint.post(
      "removePushSubscription",
      "/push/subscriptions/remove",
      {
        error: [Unauthorized, BadRequest],
        payload: removePushSubscriptionBody,
        success: browserPushSettingsSchema,
      }
    ),
    HttpApiEndpoint.post("sendTestPush", "/push/test", {
      error: [Unauthorized, BadRequest],
      success: browserPushTestResponseSchema,
    }),
    HttpApiEndpoint.post("createDestination", "/destinations", {
      error: [Unauthorized, BadRequest],
      payload: createDestinationBody,
      success: destinationSchema,
    }),
    HttpApiEndpoint.delete(
      "deleteDestination",
      "/destinations/:destinationId",
      {
        error: [Unauthorized, BadRequest],
        params: destinationParamsSchema,
        success: deleteDestinationResponseSchema,
      }
    )
  )
  .prefix("/api/settings");
