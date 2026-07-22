CREATE TYPE "season_name" AS ENUM('winter', 'spring', 'summer', 'fall');--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "season" "season_name" NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "label";