export const reactivityKey = {
  browserPushClientState: "browser-push-client-state",
  browserPushSettings: "browser-push-settings",
  downloads: "downloads",
  library: "library",
  librarySeriesState: "library-series-state",
  notificationPreferences: "notification-preferences",
  notifications: "notifications",
  settingsBootstrap: "settings-bootstrap",
  tracking: "tracking",
} as const;

export type ReactivityKey = (typeof reactivityKey)[keyof typeof reactivityKey];
