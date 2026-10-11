import { makeApiClient } from "@mangy/contract";

import { getServerOrigin } from "./server-origin";

export const api = makeApiClient(getServerOrigin());

export { decodeRefreshTrackedSeries } from "@mangy/contract";

export type {
  CreateDestination as CreateDestinationPayload,
  DiscoverSection,
  DownloadJob as DownloadItem,
  EnqueueDownload as EnqueueDownloadPayload,
  LibraryItem,
  LibrarySeriesState,
  Notification as NotificationItem,
  NotificationPreferences,
  PushSettings,
  SavePushSubscription,
  SeriesChapter,
  SettingsBootstrap,
  SourceFilterDefinition,
  SourceSearchInput,
  SourceSeries as SeriesDetail,
  SourceSeriesList as SourceSearchPage,
  SourceSummary,
  TrackedSeries,
  UpdateBrowserPushPreferences as UpdateBrowserPushPreferencesPayload,
  UpdateLibrarySeriesState as UpdateLibrarySeriesStatePayload,
  UpdateNotificationPreferences as UpdateNotificationPreferencesPayload,
} from "@mangy/contract";
