CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" uuid NOT NULL,
	"type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"orphaned_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_space_idx" ON "photos" USING btree ("space_id");