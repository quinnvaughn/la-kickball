ALTER TABLE "seasons" ADD COLUMN "year" smallint NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_slug_unique" UNIQUE("league_id","slug");