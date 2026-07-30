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
		.references(() => weeks.id, { onDelete: "cascade" }),

	homeTeamId: uuid("home_team_id")
		.notNull()
		.references(() => teams.id, { onDelete: "cascade" }),
	awayTeamId: uuid("away_team_id")
		.notNull()
		.references(() => teams.id, { onDelete: "cascade" }),

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

	// The running score. Not ref-entered — kept in sync in real time as
	// plays are logged (see game_plays), so these are already the live
	// score while the game is in progress and the final score once it
	// ends. Null until the first play is logged.
	homeScore: smallint("home_score"),
	awayScore: smallint("away_score"),

	// Nullable until a ref is assigned.
	refId: uuid("ref_id").references(() => users.id),

	// Set once the play log itself shows the game has reached one of its
	// real end conditions (regulation innings, the mercy rule, or a
	// walk-off — see domain/game-plays.ts replayGame) — there's no
	// explicit "end game" action from the ref. Distinct from a game that's
	// merely in progress (plays exist, endedAt still null).
	endedAt: timestamp("ended_at"),

	// Set when a ref calls off a game rather than letting it finish —
	// the one thing the ref does explicitly. Games are never truly
	// cancelled here, only suspended to be made up later: if the
	// stoppage happens before 4 innings are in the books, it's suspended
	// (this timestamp gets set and the game is replayed from scratch);
	// at 4+ innings the game simply counts as final on the score already
	// on the board (endedAt gets set instead, same as a normal ending).
	// Distinct from an upcoming game (no plays yet, suspendedAt null) and
	// a completed one (endedAt set, suspendedAt null).
	suspendedAt: timestamp("suspended_at"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
