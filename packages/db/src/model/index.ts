import { accountColumns, accountTable } from "./account";
import { chapterColumns, chapterTable } from "./chapter";
import {
  downloadArtifactColumns,
  downloadArtifactTable,
} from "./download-artifact";
import {
  downloadDestinationColumns,
  downloadDestinationTable,
} from "./download-destination";
import { downloadJobColumns, downloadJobTable } from "./download-job";
import { libraryEntryColumns, libraryEntryTable } from "./library-entry";
import { notificationColumns, notificationTable } from "./notification";
import {
  notificationDeliveryColumns,
  notificationDeliveryTable,
} from "./notification-delivery";
import {
  notificationEndpointColumns,
  notificationEndpointTable,
} from "./notification-endpoint";
import {
  pushSubscriptionColumns,
  pushSubscriptionTable,
} from "./push-subscription";
import { seriesColumns, seriesTable } from "./series";
import { sessionColumns, sessionTable } from "./session";
import { sourceColumns, sourceTable } from "./source";
import {
  trackedSeriesStateColumns,
  trackedSeriesStateTable,
} from "./tracked-series-state";
import { userColumns, userTable } from "./user";
import { verificationColumns, verificationTable } from "./verification";

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
  account: { columns: accountColumns, table: accountTable },
  chapter: { columns: chapterColumns, table: chapterTable },
  downloadArtifact: {
    columns: downloadArtifactColumns,
    table: downloadArtifactTable,
  },
  downloadDestination: {
    columns: downloadDestinationColumns,
    table: downloadDestinationTable,
  },
  downloadJob: { columns: downloadJobColumns, table: downloadJobTable },
  libraryEntry: { columns: libraryEntryColumns, table: libraryEntryTable },
  notification: { columns: notificationColumns, table: notificationTable },
  notificationDelivery: {
    columns: notificationDeliveryColumns,
    table: notificationDeliveryTable,
  },
  notificationEndpoint: {
    columns: notificationEndpointColumns,
    table: notificationEndpointTable,
  },
  pushSubscription: {
    columns: pushSubscriptionColumns,
    table: pushSubscriptionTable,
  },
  series: { columns: seriesColumns, table: seriesTable },
  session: { columns: sessionColumns, table: sessionTable },
  source: { columns: sourceColumns, table: sourceTable },
  trackedSeriesState: {
    columns: trackedSeriesStateColumns,
    table: trackedSeriesStateTable,
  },
  user: { columns: userColumns, table: userTable },
  verification: { columns: verificationColumns, table: verificationTable },
} as const;

export const columnsByModel: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(modelTables).map(([model, { columns }]) => [model, columns])
);
