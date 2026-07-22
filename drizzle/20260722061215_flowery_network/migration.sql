ALTER TABLE "leagues" ALTER COLUMN "location_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "start_time" SET DATA TYPE time USING "start_time"::time;--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "end_time" SET DATA TYPE time USING "end_time"::time;