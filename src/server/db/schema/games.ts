import {
	pgEnum,
	pgTable,
	smallint,
	text,
	time,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core"
import { teams } from "./teams"
import { users } from "./users"
import { weeks } from "./weeks"

export const gameRoundEnum = pgEnum("game_round", [
	"regular",
	"quarterfinal",
	"semifinal",
	"final",
])

export const games = pgTable("games", {
	id: uuid("id").defaultRandom().primaryKey(),

	weekId: uuid("week_id")
		.notNull()
		.references(() => weeks.id),

	homeTeamId: uuid("home_team_id")
		.notNull()
		.references(() => teams.id),
	awayTeamId: uuid("away_team_id")
		.notNull()
		.references(() => teams.id),

	// Which kind of game this is within its week. "final" is what lets
	// seasons.winnerId auto-populate once a score lands on this row —
	// see the seasons discussion. Defaults to "regular" since most
	// games are.
	round: gameRoundEnum("round").notNull().default("regular"),

	field: text("field"), // e.g. "Field 1" — nullable until assigned

	// A week has one date (weeks.date), but games within it can still
	// run at different times back-to-back, hence a time here on top
	// of the week's date.
	startTime: time("start_time"),

	// Nullable until the ref actually logs it. Both null = upcoming.
	// Both set = final. There's no "game in progress" state modeled —
	// a ref enters the final score after the game, not live play-by-play.
	homeScore: smallint("home_score"),
	awayScore: smallint("away_score"),

	// Nullable until a ref is assigned.
	refId: uuid("ref_id").references(() => users.id),

	// Set when a game is rained out / called off rather than played.
	// Distinct from an upcoming game (scores null, cancelledAt null)
	// and a completed one (scores set, cancelledAt null).
	cancelledAt: timestamp("cancelled_at"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
