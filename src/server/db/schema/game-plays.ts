import {
	integer,
	jsonb,
	pgEnum,
	pgTable,
	smallint,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core"
import { games } from "./games"
import { users } from "./users"

export const playOutcomeEnum = pgEnum("play_outcome", [
	"single",
	"double",
	"triple",
	"homer",
	"walk",
	"sac",
	"out",
])

export const gamePlays = pgTable(
	"game_plays",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		gameId: uuid("game_id")
			.notNull()
			.references(() => games.id, { onDelete: "cascade" }),

		// Explicit order within the game — plays confirmed in quick
		// succession could share a timestamp, this is the real ordering.
		sequence: integer("sequence").notNull(),

		batterId: uuid("batter_id")
			.notNull()
			.references(() => users.id),
		outcome: playOutcomeEnum("outcome").notNull(),

		// Stored for convenience — technically re-derivable by replaying
		// every prior play, but nobody debugging a play from three weeks
		// ago wants to replay the whole game just to see what inning it was.
		half: smallint("half").notNull(), // 0 = top, 1 = bottom
		inning: smallint("inning").notNull(),

		// The shape genuinely varies play to play (0 to 3 runners, each
		// independently held/advanced/scored/out), which is exactly the
		// case where JSON earns its keep instead of static columns:
		// [{ "runnerId": "...", "fromBase": 1, "result": "scored" }, ...]
		runnerEvents: jsonb("runner_events").notNull().default([]),

		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [unique().on(table.gameId, table.sequence)],
)

export type GamePlay = typeof gamePlays.$inferSelect
export type NewGamePlay = typeof gamePlays.$inferInsert
