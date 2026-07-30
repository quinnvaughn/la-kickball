ALTER TABLE "mvp_awards" DROP CONSTRAINT "mvp_awards_season_id_key";--> statement-breakpoint
ALTER TABLE "mvp_awards" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mvp_awards" ADD CONSTRAINT "mvp_awards_season_id_category_unique" UNIQUE("season_id","category");--> statement-breakpoint
ALTER TABLE "mvp_awards" DROP CONSTRAINT "scope_matches_category", ADD CONSTRAINT "scope_matches_category" CHECK (
				("week_id" IS NOT NULL AND "season_id" IS NULL)
				OR
				("season_id" IS NOT NULL AND "week_id" IS NULL)
			);