DROP TABLE IF EXISTS "event" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "calendar" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."download_job_status" AS ENUM('queued', 'running', 'retryableFailed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_endpoint_type" AS ENUM('inApp', 'slack');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('downloadCompleted', 'downloadFailed', 'trackedSeriesUpdated', 'systemWarning');--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"language_code" text DEFAULT 'multi' NOT NULL,
	"website_url" text NOT NULL,
	"description" text NOT NULL,
	"icon_url" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"supports_popular" boolean DEFAULT false NOT NULL,
	"supports_latest" boolean DEFAULT false NOT NULL,
	"supports_trending" boolean DEFAULT false NOT NULL,
	"supports_search" boolean DEFAULT false NOT NULL,
	"supports_filters" boolean DEFAULT false NOT NULL,
	"supports_series_details" boolean DEFAULT false NOT NULL,
	"supports_chapter_feed" boolean DEFAULT false NOT NULL,
	"supports_page_fetch" boolean DEFAULT false NOT NULL,
	"supported_languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"canonical_url" text,
	"cover_image_url" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"original_language" text,
	"latest_chapter" text,
	"content_rating" text,
	"publication_demographic" text,
	"author_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"artist_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"available_translated_languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "chapter" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text,
	"chapter_number" text,
	"volume_number" text,
	"translated_language" text,
	"external_url" text,
	"source_order" text,
	"page_count" integer,
	"published_at" timestamp,
	"is_unavailable" boolean DEFAULT false NOT NULL,
	"is_downloaded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "download_destination" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"absolute_path" text NOT NULL,
	"komga_library_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "library_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"series_id" text NOT NULL,
	"download_destination_id" text,
	"is_tracked" boolean DEFAULT false NOT NULL,
	"auto_download" boolean DEFAULT false NOT NULL,
	"last_opened_chapter_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "tracked_series_state" (
	"id" text PRIMARY KEY NOT NULL,
	"library_entry_id" text NOT NULL,
	"last_checked_at" timestamp,
	"next_check_at" timestamp,
	"last_seen_chapter_external_id" text,
	"check_failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "download_job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"series_id" text,
	"chapter_id" text,
	"download_destination_id" text,
	"status" "download_job_status" DEFAULT 'queued' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_owner" text,
	"leased_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "download_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"download_job_id" text NOT NULL,
	"chapter_id" text,
	"output_path" text NOT NULL,
	"package_format" text DEFAULT 'folder' NOT NULL,
	"file_size_bytes" integer,
	"imported_to_komga_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "notification_endpoint" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_endpoint_type" DEFAULT 'inApp' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"masked_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" DEFAULT 'systemWarning' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_destination" ADD CONSTRAINT "download_destination_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entry" ADD CONSTRAINT "library_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entry" ADD CONSTRAINT "library_entry_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entry" ADD CONSTRAINT "library_entry_download_destination_id_download_destination_id_fk" FOREIGN KEY ("download_destination_id") REFERENCES "public"."download_destination"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_series_state" ADD CONSTRAINT "tracked_series_state_library_entry_id_library_entry_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_job" ADD CONSTRAINT "download_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_job" ADD CONSTRAINT "download_job_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_job" ADD CONSTRAINT "download_job_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_job" ADD CONSTRAINT "download_job_download_destination_id_download_destination_id_fk" FOREIGN KEY ("download_destination_id") REFERENCES "public"."download_destination"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_artifact" ADD CONSTRAINT "download_artifact_download_job_id_download_job_id_fk" FOREIGN KEY ("download_job_id") REFERENCES "public"."download_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_artifact" ADD CONSTRAINT "download_artifact_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_endpoint" ADD CONSTRAINT "notification_endpoint_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_enabled_idx" ON "source" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "series_source_idx" ON "series" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "series_title_idx" ON "series" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "series_source_external_idx" ON "series" USING btree ("source_id", "external_id");--> statement-breakpoint
CREATE INDEX "chapter_series_idx" ON "chapter" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "chapter_published_at_idx" ON "chapter" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_series_external_idx" ON "chapter" USING btree ("series_id", "external_id");--> statement-breakpoint
CREATE INDEX "download_destination_user_idx" ON "download_destination" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_entry_user_idx" ON "library_entry" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "library_entry_user_series_idx" ON "library_entry" USING btree ("user_id", "series_id");--> statement-breakpoint
CREATE INDEX "tracked_series_library_idx" ON "tracked_series_state" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX "download_job_user_idx" ON "download_job" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "download_job_status_idx" ON "download_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "download_artifact_job_idx" ON "download_artifact" USING btree ("download_job_id");--> statement-breakpoint
CREATE INDEX "notification_endpoint_user_idx" ON "notification_endpoint" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id");
