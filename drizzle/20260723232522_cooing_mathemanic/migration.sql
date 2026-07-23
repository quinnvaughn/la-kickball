CREATE TYPE "play_outcome" AS ENUM('single', 'double', 'triple', 'homer', 'walk', 'sac', 'out');--> statement-breakpoint
CREATE TABLE "game_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"batter_id" uuid NOT NULL,
	"outcome" "play_outcome" NOT NULL,
	"half" smallint NOT NULL,
	"inning" smallint NOT NULL,
	"runner_events" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_plays_game_id_sequence_unique" UNIQUE("game_id","sequence")
);
--> statement-breakpoint
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id");--> statement-breakpoint
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_batter_id_users_id_fkey" FOREIGN KEY ("batter_id") REFERENCES "users"("id");