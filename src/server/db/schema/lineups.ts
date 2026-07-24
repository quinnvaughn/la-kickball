import { pgTable, smallint, unique, uuid } from "drizzle-orm/pg-core"
import { games } from "./games"
import { teams } from "./teams"
import { users } from "./users"

// One row per player per team per game — the batting order a captain
// sets for that specific game. Fielding position isn't tracked here: it
// rotates inning to inning and isn't part of a fixed lineup.
export const lineupEntries = pgTable(
	"lineup_entries",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		gameId: uuid("game_id")
			.notNull()
			.references(() => games.id, { onDelete: "cascade" }),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		battingOrder: smallint("batting_order").notNull(),
	},
	(table) => [
		unique("one_slot_per_batting_order").on(
			table.gameId,
			table.teamId,
			table.battingOrder,
		),
		unique("one_lineup_spot_per_player").on(
			table.gameId,
			table.teamId,
			table.userId,
		),
	],
)

export type LineupEntry = typeof lineupEntries.$inferSelect
export type NewLineupEntry = typeof lineupEntries.$inferInsert
