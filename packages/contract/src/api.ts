import { HttpApi } from "effect/http-api";

import { ApiKeysApi } from "./api-keys";
import { CurrentUserMiddleware } from "./current-user-middleware";
import { DownloadsApi } from "./downloads";
import { LibraryApi } from "./library";
import { LiveApi } from "./live";
import { NotificationsApi } from "./notifications";
import { SeriesApi } from "./series";
import { SettingsApi } from "./settings";
import { SourcesApi } from "./sources";
import { TrackingApi } from "./tracking";

export const Api = HttpApi.make("mangy-api")
  .add(TrackingApi)
  .add(NotificationsApi)
  .add(DownloadsApi)
  .add(LibraryApi)
  .add(SourcesApi)
  .add(SeriesApi)
  .add(SettingsApi)
  .add(ApiKeysApi)
  .add(LiveApi)
  .middleware(CurrentUserMiddleware);
