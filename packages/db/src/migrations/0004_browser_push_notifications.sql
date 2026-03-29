ALTER TYPE "public"."notification_endpoint_type" ADD VALUE IF NOT EXISTS 'browserPush';--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_channel" AS ENUM('browserPush', 'slack');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued', 'running', 'retryableFailed', 'delivered', 'permanentFailed');--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "notify_on_download_completed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "notify_on_download_failed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "notify_on_tracked_series_update" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "notify_on_system_warning" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "last_error_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD COLUMN "last_delivered_at" timestamp;--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"expiration_time" timestamp,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_error" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"notification_endpoint_id" text,
	"push_subscription_id" text,
	"channel" "notification_delivery_channel" DEFAULT 'browserPush' NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"lease_owner" text,
	"leased_at" timestamp,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_endpoint_id_notification_endpoint_id_fk" FOREIGN KEY ("notification_endpoint_id") REFERENCES "public"."notification_endpoint"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_push_subscription_id_push_subscription_id_fk" FOREIGN KEY ("push_subscription_id") REFERENCES "public"."push_subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscription_active_idx" ON "push_subscription" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscription_endpoint_idx" ON "push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "notification_delivery_notification_idx" ON "notification_delivery" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_status_idx" ON "notification_delivery" USING btree ("status", "next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_push_idx" ON "notification_delivery" USING btree ("notification_id", "push_subscription_id", "channel");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_endpoint_user_type_idx" ON "notification_endpoint" USING btree ("user_id", "type");
