import {
  accountColumns,
  accountRow,
  sessionColumns,
  sessionRow,
  userColumns,
  userRow,
  verificationColumns,
  verificationRow,
} from "./auth";
import {
  downloadArtifactColumns,
  downloadArtifactRow,
  downloadJobColumns,
  downloadJobRow,
} from "./downloads";
import {
  downloadDestinationColumns,
  downloadDestinationRow,
  libraryEntryColumns,
  libraryEntryRow,
  trackedSeriesStateColumns,
  trackedSeriesStateRow,
} from "./library";
import {
  notificationColumns,
  notificationDeliveryColumns,
  notificationDeliveryRow,
  notificationEndpointColumns,
  notificationEndpointRow,
  notificationRow,
  pushSubscriptionColumns,
  pushSubscriptionRow,
} from "./notifications";
import {
  chapterColumns,
  chapterRow,
  seriesColumns,
  seriesRow,
  sourceColumns,
  sourceRow,
} from "./sources";

export * from "./auth";
export * from "./downloads";
export * from "./library";
export * from "./notifications";
export * from "./sources";
export * from "./table";

export const modelTables = {
  account: { columns: accountColumns, row: accountRow },
  chapter: { columns: chapterColumns, row: chapterRow },
  downloadArtifact: {
    columns: downloadArtifactColumns,
    row: downloadArtifactRow,
  },
  downloadDestination: {
    columns: downloadDestinationColumns,
    row: downloadDestinationRow,
  },
  downloadJob: { columns: downloadJobColumns, row: downloadJobRow },
  libraryEntry: { columns: libraryEntryColumns, row: libraryEntryRow },
  notification: { columns: notificationColumns, row: notificationRow },
  notificationDelivery: {
    columns: notificationDeliveryColumns,
    row: notificationDeliveryRow,
  },
  notificationEndpoint: {
    columns: notificationEndpointColumns,
    row: notificationEndpointRow,
  },
  pushSubscription: {
    columns: pushSubscriptionColumns,
    row: pushSubscriptionRow,
  },
  series: { columns: seriesColumns, row: seriesRow },
  session: { columns: sessionColumns, row: sessionRow },
  source: { columns: sourceColumns, row: sourceRow },
  trackedSeriesState: {
    columns: trackedSeriesStateColumns,
    row: trackedSeriesStateRow,
  },
  user: { columns: userColumns, row: userRow },
  verification: { columns: verificationColumns, row: verificationRow },
} as const;

export const columnsByModel: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(modelTables).map(([model, { columns }]) => [model, columns])
);
