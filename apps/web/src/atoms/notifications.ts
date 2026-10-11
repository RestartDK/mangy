import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";

export type { Notification as NotificationItem } from "@mangy/contract";

export const notificationsQuery = ApiAtoms.query("notifications", "list", {
  reactivityKeys: [reactivityKey.notifications],
});

export const notificationPreferencesQuery = ApiAtoms.query(
  "notifications",
  "getPreferences",
  { reactivityKeys: [reactivityKey.notificationPreferences] }
);

export const markNotificationRead = ApiAtoms.mutation(
  "notifications",
  "markRead"
);

export const markAllNotificationsRead = ApiAtoms.mutation(
  "notifications",
  "markAllRead"
);

export const updateNotificationPreferences = ApiAtoms.mutation(
  "notifications",
  "updatePreferences"
);
