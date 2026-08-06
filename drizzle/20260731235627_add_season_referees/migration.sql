CREATE TABLE "season_referees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "season_referees_season_id_user_id_unique" UNIQUE("season_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "season_referees" ADD CONSTRAINT "season_referees_season_id_seasons_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "season_referees" ADD CONSTRAINT "season_referees_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");