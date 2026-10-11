import type { Schema } from "effect";

import { Account, accountColumns, accountTable } from "./account";
import { Chapter, chapterColumns, chapterTable } from "./chapter";
import {
  DownloadArtifact,
  downloadArtifactColumns,
  downloadArtifactTable,
} from "./download-artifact";
import {
  DownloadDestination,
  downloadDestinationColumns,
  downloadDestinationTable,
} from "./download-destination";
import {
  DownloadJob,
  downloadJobColumns,
  downloadJobTable,
} from "./download-job";
import {
  LibraryEntry,
  libraryEntryColumns,
  libraryEntryTable,
} from "./library-entry";
import {
  Notification,
  notificationColumns,
  notificationTable,
} from "./notification";
import {
  NotificationDelivery,
  notificationDeliveryColumns,
  notificationDeliveryTable,
} from "./notification-delivery";
import {
  NotificationEndpoint,
  notificationEndpointColumns,
  notificationEndpointTable,
} from "./notification-endpoint";
import {
  PushSubscription,
  pushSubscriptionColumns,
  pushSubscriptionTable,
} from "./push-subscription";
import { Series, seriesColumns, seriesTable } from "./series";
import { Session, sessionColumns, sessionTable } from "./session";
import { Source, sourceColumns, sourceTable } from "./source";
import {
  TrackedSeriesState,
  trackedSeriesStateColumns,
  trackedSeriesStateTable,
} from "./tracked-series-state";
import { User, userColumns, userTable } from "./user";
import {
  Verification,
  verificationColumns,
  verificationTable,
} from "./verification";

export * from "./user";
export * from "./session";
export * from "./account";
export * from "./verification";
export * from "./source";
export * from "./series";
export * from "./chapter";
export * from "./download-destination";
export * from "./library-entry";
export * from "./tracked-series-state";
export * from "./download-job";
export * from "./download-artifact";
export * from "./notification-endpoint";
export * from "./push-subscription";
export * from "./notification";
export * from "./notification-delivery";
export * from "./ids";

export const modelTables = {
  account: { columns: accountColumns, schema: Account, table: accountTable },
  chapter: { columns: chapterColumns, schema: Chapter, table: chapterTable },
  downloadArtifact: {
    columns: downloadArtifactColumns,
    schema: DownloadArtifact,
    table: downloadArtifactTable,
  },
  downloadDestination: {
    columns: downloadDestinationColumns,
    schema: DownloadDestination,
    table: downloadDestinationTable,
  },
  downloadJob: {
    columns: downloadJobColumns,
    schema: DownloadJob,
    table: downloadJobTable,
  },
  libraryEntry: {
    columns: libraryEntryColumns,
    schema: LibraryEntry,
    table: libraryEntryTable,
  },
  notification: {
    columns: notificationColumns,
    schema: Notification,
    table: notificationTable,
  },
  notificationDelivery: {
    columns: notificationDeliveryColumns,
    schema: NotificationDelivery,
    table: notificationDeliveryTable,
  },
  notificationEndpoint: {
    columns: notificationEndpointColumns,
    schema: NotificationEndpoint,
    table: notificationEndpointTable,
  },
  pushSubscription: {
    columns: pushSubscriptionColumns,
    schema: PushSubscription,
    table: pushSubscriptionTable,
  },
  series: { columns: seriesColumns, schema: Series, table: seriesTable },
  session: { columns: sessionColumns, schema: Session, table: sessionTable },
  source: { columns: sourceColumns, schema: Source, table: sourceTable },
  trackedSeriesState: {
    columns: trackedSeriesStateColumns,
    schema: TrackedSeriesState,
    table: trackedSeriesStateTable,
  },
  user: { columns: userColumns, schema: User, table: userTable },
  verification: {
    columns: verificationColumns,
    schema: Verification,
    table: verificationTable,
  },
} as const;

export const columnsByModel: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(modelTables).map(([model, { columns }]) => [model, columns])
);

/**
 * A decoded row schema as exposed by `Model.Class`. The concrete field map is
 * intentionally widened here so the registry can be indexed by an arbitrary
 * model name, the same way `columnsByModel` is.
 */
export type ModelRowSchema = Schema.Top & {
  readonly fields: Schema.Struct.Fields;
};

/** Row schemas for every known model, keyed the same way as `columnsByModel`. */
export const schemasByModel: Record<string, ModelRowSchema> =
  Object.fromEntries(
    Object.entries(modelTables).map(([model, { schema }]) => [model, schema])
  );
