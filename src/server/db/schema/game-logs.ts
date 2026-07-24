import { pgTable, smallint, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { games } from "./games"
import { users } from "./users"

export const gameLogs = pgTable(
	"game_logs",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		gameId: uuid("game_id")
			.notNull()
			.references(() => games.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),

		// Raw counting stats. Everything else (average, slugging, OPS)
		// is computed from these, never stored
		atBats: smallint("at_bats").notNull().default(0),
		runs: smallint("runs").notNull().default(0),
		rki: smallint("rki").notNull().default(0),
		singles: smallint("singles").notNull().default(0),
		doubles: smallint("doubles").notNull().default(0),
		triples: smallint("triples").notNull().default(0),
		homers: smallint("homers").notNull().default(0),
		walks: smallint("walks").notNull().default(0),
		sacs: smallint("sacs").notNull().default(0),

		// Baserunning value beyond the standard advance for whatever hit
		// put them in motion — 1st-to-3rd on a single is +1, scoring from
		// 2nd on a single is also +1, scoring from 1st is +2. This treats
		// "extra base taken" and "run manufactured via extra bases" as
		// the same unit of value, which is a real judgment call, not an
		// obviously correct one
		extraBasesTaken: smallint("extra_bases_taken").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.gameId, table.userId)],
)

export type GameLog = typeof gameLogs.$inferSelect
export type NewGameLog = typeof gameLogs.$inferInsert
