import { Schema } from "effect";

export const AccountIdSchema = Schema.String.pipe(Schema.brand("AccountId"));
export type AccountId = typeof AccountIdSchema.Type;

export const ChapterIdSchema = Schema.String.pipe(Schema.brand("ChapterId"));
export type ChapterId = typeof ChapterIdSchema.Type;

export const DownloadArtifactIdSchema = Schema.String.pipe(
  Schema.brand("DownloadArtifactId")
);
export type DownloadArtifactId = typeof DownloadArtifactIdSchema.Type;

export const DownloadDestinationIdSchema = Schema.String.pipe(
  Schema.brand("DownloadDestinationId")
);
export type DownloadDestinationId = typeof DownloadDestinationIdSchema.Type;

export const DownloadJobIdSchema = Schema.String.pipe(
  Schema.brand("DownloadJobId")
);
export type DownloadJobId = typeof DownloadJobIdSchema.Type;

export const LibraryEntryIdSchema = Schema.String.pipe(
  Schema.brand("LibraryEntryId")
);
export type LibraryEntryId = typeof LibraryEntryIdSchema.Type;

export const NotificationDeliveryIdSchema = Schema.String.pipe(
  Schema.brand("NotificationDeliveryId")
);
export type NotificationDeliveryId = typeof NotificationDeliveryIdSchema.Type;

export const NotificationEndpointIdSchema = Schema.String.pipe(
  Schema.brand("NotificationEndpointId")
);
export type NotificationEndpointId = typeof NotificationEndpointIdSchema.Type;

export const NotificationIdSchema = Schema.String.pipe(
  Schema.brand("NotificationId")
);
export type NotificationId = typeof NotificationIdSchema.Type;

export const PushSubscriptionIdSchema = Schema.String.pipe(
  Schema.brand("PushSubscriptionId")
);
export type PushSubscriptionId = typeof PushSubscriptionIdSchema.Type;

export const SeriesIdSchema = Schema.String.pipe(Schema.brand("SeriesId"));
export type SeriesId = typeof SeriesIdSchema.Type;

export const SessionIdSchema = Schema.String.pipe(Schema.brand("SessionId"));
export type SessionId = typeof SessionIdSchema.Type;

export const SourceIdSchema = Schema.String.pipe(Schema.brand("SourceId"));
export type SourceId = typeof SourceIdSchema.Type;

export const TrackedSeriesStateIdSchema = Schema.String.pipe(
  Schema.brand("TrackedSeriesStateId")
);
export type TrackedSeriesStateId = typeof TrackedSeriesStateIdSchema.Type;

export const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserIdSchema.Type;

export const VerificationIdSchema = Schema.String.pipe(
  Schema.brand("VerificationId")
);
export type VerificationId = typeof VerificationIdSchema.Type;
