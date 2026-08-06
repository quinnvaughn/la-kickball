import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { seasons } from "./seasons"
import { users } from "./users"

// The pool of refs available for a season — who an admin can pick from
// when assigning games.refId for a given game in that season.
export const seasonReferees = pgTable(
	"season_referees",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		seasonId: uuid("season_id")
			.notNull()
			.references(() => seasons.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [unique().on(table.seasonId, table.userId)],
)

export type SeasonReferee = typeof seasonReferees.$inferSelect
export type NewSeasonReferee = typeof seasonReferees.$inferInsert
