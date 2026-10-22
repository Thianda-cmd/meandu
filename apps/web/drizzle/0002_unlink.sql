ALTER TABLE "members" ADD COLUMN "wants_back" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "paused_by" text;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "paused_at" timestamp with time zone;