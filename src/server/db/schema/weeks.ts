import {
	date,
	pgTable,
	smallint,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core"
import { seasons } from "./seasons"

export const weeks = pgTable(
	"weeks",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		seasonId: uuid("season_id")
			.notNull()
			.references(() => seasons.id),

		// 1-indexed. Regular season weeks come first (1..seasons.weeks),
		// playoff weeks continue the same sequence rather than resetting —
		// week 9 in an 8-week season is the first playoff week. Whether a
		// given week IS a playoff week is a property of the games inside
		// it (see games.round), not of the week itself.
		weekNumber: smallint("week_number").notNull(),

		// Nullable until scheduled — a season can exist with its weeks
		// laid out before every date is locked in.
		date: date("date"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.seasonId, table.weekNumber)],
)

export type Week = typeof weeks.$inferSelect
export type NewWeek = typeof weeks.$inferInsert
