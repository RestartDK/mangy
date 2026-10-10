import {
  accountColumns,
  accountRow,
  accountTable,
  sessionColumns,
  sessionRow,
  sessionTable,
  userColumns,
  userRow,
  userTable,
  verificationColumns,
  verificationRow,
  verificationTable,
} from "./auth";
import {
  downloadArtifactColumns,
  downloadArtifactRow,
  downloadArtifactTable,
  downloadJobColumns,
  downloadJobRow,
  downloadJobTable,
} from "./downloads";
import {
  downloadDestinationColumns,
  downloadDestinationRow,
  downloadDestinationTable,
  libraryEntryColumns,
  libraryEntryRow,
  libraryEntryTable,
  trackedSeriesStateColumns,
  trackedSeriesStateRow,
  trackedSeriesStateTable,
} from "./library";
import {
  notificationColumns,
  notificationDeliveryColumns,
  notificationDeliveryRow,
  notificationDeliveryTable,
  notificationEndpointColumns,
  notificationEndpointRow,
  notificationEndpointTable,
  notificationRow,
  notificationTable,
  pushSubscriptionColumns,
  pushSubscriptionRow,
  pushSubscriptionTable,
} from "./notifications";
import {
  chapterColumns,
  chapterRow,
  chapterTable,
  seriesColumns,
  seriesRow,
  seriesTable,
  sourceColumns,
  sourceRow,
  sourceTable,
} from "./sources";

export * from "./auth";
export * from "./downloads";
export * from "./library";
export * from "./notifications";
export * from "./sources";
export * from "./table";

export const modelTables = {
  account: { columns: accountColumns, row: accountRow, table: accountTable },
  chapter: { columns: chapterColumns, row: chapterRow, table: chapterTable },
  downloadArtifact: {
    columns: downloadArtifactColumns,
    row: downloadArtifactRow,
    table: downloadArtifactTable,
  },
  downloadDestination: {
    columns: downloadDestinationColumns,
    row: downloadDestinationRow,
    table: downloadDestinationTable,
  },
  downloadJob: {
    columns: downloadJobColumns,
    row: downloadJobRow,
    table: downloadJobTable,
  },
  libraryEntry: {
    columns: libraryEntryColumns,
    row: libraryEntryRow,
    table: libraryEntryTable,
  },
  notification: {
    columns: notificationColumns,
    row: notificationRow,
    table: notificationTable,
  },
  notificationDelivery: {
    columns: notificationDeliveryColumns,
    row: notificationDeliveryRow,
    table: notificationDeliveryTable,
  },
  notificationEndpoint: {
    columns: notificationEndpointColumns,
    row: notificationEndpointRow,
    table: notificationEndpointTable,
  },
  pushSubscription: {
    columns: pushSubscriptionColumns,
    row: pushSubscriptionRow,
    table: pushSubscriptionTable,
  },
  series: { columns: seriesColumns, row: seriesRow, table: seriesTable },
  session: { columns: sessionColumns, row: sessionRow, table: sessionTable },
  source: { columns: sourceColumns, row: sourceRow, table: sourceTable },
  trackedSeriesState: {
    columns: trackedSeriesStateColumns,
    row: trackedSeriesStateRow,
    table: trackedSeriesStateTable,
  },
  user: { columns: userColumns, row: userRow, table: userTable },
  verification: {
    columns: verificationColumns,
    row: verificationRow,
    table: verificationTable,
  },
} as const;

export const columnsByModel: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(modelTables).map(([model, { columns }]) => [model, columns])
);
