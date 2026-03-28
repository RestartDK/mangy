import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const notificationEndpointType = pgEnum("notification_endpoint_type", [
  "inApp",
  "slack",
]);

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
    maskedValue: text("masked_value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("notification_endpoint_user_idx").on(table.userId)]
);

export const notificationEndpointRelations = relations(
  notificationEndpoint,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationEndpoint.userId],
      references: [user.id],
    }),
  })
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

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
}));
