CREATE TYPE "game_round" AS ENUM('regular', 'quarterfinal', 'semifinal', 'final');--> statement-breakpoint
CREATE TABLE "free_agent_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "one_offer_per_week" UNIQUE("user_id","week_id")
);
--> statement-breakpoint
CREATE TABLE "free_agent_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"team_id" uuid NOT NULL,
	"availability_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	CONSTRAINT "one_invite_per_team_per_offer" UNIQUE("team_id","availability_id")
);
--> statement-breakpoint
CREATE TABLE "game_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"at_bats" smallint DEFAULT 0 NOT NULL,
	"runs" smallint DEFAULT 0 NOT NULL,
	"rki" smallint DEFAULT 0 NOT NULL,
	"singles" smallint DEFAULT 0 NOT NULL,
	"doubles" smallint DEFAULT 0 NOT NULL,
	"triples" smallint DEFAULT 0 NOT NULL,
	"homers" smallint DEFAULT 0 NOT NULL,
	"walks" smallint DEFAULT 0 NOT NULL,
	"sacs" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_logs_game_id_user_id_unique" UNIQUE("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"week_id" uuid NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"round" "game_round" DEFAULT 'regular'::"game_round" NOT NULL,
	"field" text,
	"start_time" time,
	"home_score" smallint,
	"away_score" smallint,
	"ref_id" uuid,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineup_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"game_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"batting_order" smallint NOT NULL,
	CONSTRAINT "one_slot_per_batting_order" UNIQUE("game_id","team_id","batting_order"),
	CONSTRAINT "one_lineup_spot_per_player" UNIQUE("game_id","team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mvp_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"week_id" uuid,
	"season_id" uuid UNIQUE,
	"category" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mvp_awards_week_id_category_unique" UNIQUE("week_id","category"),
	CONSTRAINT "scope_matches_category" CHECK (
				("week_id" IS NOT NULL AND "season_id" IS NULL AND "category" IS NOT NULL)
				OR
				("season_id" IS NOT NULL AND "week_id" IS NULL AND "category" IS NULL)
			)
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"season_id" uuid NOT NULL,
	"week_number" smallint NOT NULL,
	"date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weeks_season_id_week_number_unique" UNIQUE("season_id","week_number")
);
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "winner_id" uuid;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD COLUMN "week_id" uuid;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_user_id_week_id_unique" UNIQUE("team_id","user_id","week_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_accepted_invite_per_offer" ON "free_agent_invites" ("availability_id") WHERE "accepted_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "free_agent_availability" ADD CONSTRAINT "free_agent_availability_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "free_agent_availability" ADD CONSTRAINT "free_agent_availability_week_id_weeks_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id");--> statement-breakpoint
ALTER TABLE "free_agent_invites" ADD CONSTRAINT "free_agent_invites_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "free_agent_invites" ADD CONSTRAINT "free_agent_invites_jyY1DEx9UYvs_fkey" FOREIGN KEY ("availability_id") REFERENCES "free_agent_availability"("id");--> statement-breakpoint
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id");--> statement-breakpoint
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_week_id_weeks_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_ref_id_users_id_fkey" FOREIGN KEY ("ref_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "lineup_entries" ADD CONSTRAINT "lineup_entries_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id");--> statement-breakpoint
ALTER TABLE "lineup_entries" ADD CONSTRAINT "lineup_entries_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "lineup_entries" ADD CONSTRAINT "lineup_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "mvp_awards" ADD CONSTRAINT "mvp_awards_week_id_weeks_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id");--> statement-breakpoint
ALTER TABLE "mvp_awards" ADD CONSTRAINT "mvp_awards_season_id_seasons_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id");--> statement-breakpoint
ALTER TABLE "mvp_awards" ADD CONSTRAINT "mvp_awards_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_winner_id_teams_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_week_id_weeks_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id");--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_season_id_seasons_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id");