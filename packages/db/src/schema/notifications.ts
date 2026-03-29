import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const notificationEndpointType = pgEnum("notification_endpoint_type", [
  "inApp",
  "browserPush",
  "slack",
]);

export const notificationDeliveryChannel = pgEnum(
  "notification_delivery_channel",
  ["browserPush", "slack"]
);

export const notificationDeliveryStatus = pgEnum(
  "notification_delivery_status",
  ["queued", "running", "retryableFailed", "delivered", "permanentFailed"]
);

export const notificationType = pgEnum("notification_type", [
  "downloadCompleted",
  "downloadFailed",
  "trackedSeriesUpdated",
  "systemWarning",
]);

export const notificationEndpoint = pgTable(
  "notification_endpoint",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationEndpointType("type").default("inApp").notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    notifyOnDownloadCompleted: boolean("notify_on_download_completed")
      .default(true)
      .notNull(),
    notifyOnDownloadFailed: boolean("notify_on_download_failed")
      .default(true)
      .notNull(),
    notifyOnTrackedSeriesUpdate: boolean("notify_on_tracked_series_update")
      .default(true)
      .notNull(),
    notifyOnSystemWarning: boolean("notify_on_system_warning")
      .default(true)
      .notNull(),
    maskedValue: text("masked_value"),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at"),
    lastDeliveredAt: timestamp("last_delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("notification_endpoint_user_idx").on(table.userId),
    uniqueIndex("notification_endpoint_user_type_idx").on(
      table.userId,
      table.type
    ),
  ]
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    expirationTime: timestamp("expiration_time"),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").default(true).notNull(),
    lastError: text("last_error"),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("push_subscription_user_idx").on(table.userId),
    index("push_subscription_active_idx").on(table.isActive),
    uniqueIndex("push_subscription_endpoint_idx").on(table.endpoint),
  ]
);

export const notification = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").default("systemWarning").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("notification_user_idx").on(table.userId)]
);

export const notificationDelivery = pgTable(
  "notification_delivery",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    notificationEndpointId: text("notification_endpoint_id").references(
      () => notificationEndpoint.id,
      { onDelete: "set null" }
    ),
    pushSubscriptionId: text("push_subscription_id").references(
      () => pushSubscription.id,
      { onDelete: "set null" }
    ),
    channel: notificationDeliveryChannel("channel")
      .default("browserPush")
      .notNull(),
    status: notificationDeliveryStatus("status").default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    leaseOwner: text("lease_owner"),
    leasedAt: timestamp("leased_at"),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("notification_delivery_notification_idx").on(table.notificationId),
    index("notification_delivery_status_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    uniqueIndex("notification_delivery_push_idx").on(
      table.notificationId,
      table.pushSubscriptionId,
      table.channel
    ),
  ]
);

export const pushSubscriptionRelations = relations(
  pushSubscription,
  ({ many, one }) => ({
    user: one(user, {
      fields: [pushSubscription.userId],
      references: [user.id],
    }),
    deliveries: many(notificationDelivery),
  })
);

export const notificationEndpointRelations = relations(
  notificationEndpoint,
  ({ many, one }) => ({
    user: one(user, {
      fields: [notificationEndpoint.userId],
      references: [user.id],
    }),
    deliveries: many(notificationDelivery),
  })
);

export const notificationRelations = relations(
  notification,
  ({ many, one }) => ({
    user: one(user, {
      fields: [notification.userId],
      references: [user.id],
    }),
    deliveries: many(notificationDelivery),
  })
);

export const notificationDeliveryRelations = relations(
  notificationDelivery,
  ({ one }) => ({
    notification: one(notification, {
      fields: [notificationDelivery.notificationId],
      references: [notification.id],
    }),
    notificationEndpoint: one(notificationEndpoint, {
      fields: [notificationDelivery.notificationEndpointId],
      references: [notificationEndpoint.id],
    }),
    pushSubscription: one(pushSubscription, {
      fields: [notificationDelivery.pushSubscriptionId],
      references: [pushSubscription.id],
    }),
  })
);
