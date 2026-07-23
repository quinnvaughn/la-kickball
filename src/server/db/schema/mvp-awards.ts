import { sql } from "drizzle-orm"
import {
	check,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core"
import { seasons } from "./seasons"
import { users } from "./users"
import { weeks } from "./weeks"

export const mvpAwards = pgTable(
	"mvp_awards",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		// Exactly one of these two is set — this row is either a week
		// award or a season award, never both, never neither.
		weekId: uuid("week_id").references(() => weeks.id),
		seasonId: uuid("season_id").references(() => seasons.id),

		// Required for week awards ("guy" / "girl"), null for season
		// awards — a season only ever has one overall MVP, coed or not,
		// there's no category split at that scope.
		category: text("category"),

		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// Either a week award (weekId set, category required) or a
		// season award (seasonId set, category must be null) — never
		// both, never neither, and never a week award missing its
		// category or a season award with one it shouldn't have.
		check(
			"scope_matches_category",
			sql`
				(${table.weekId} IS NOT NULL AND ${table.seasonId} IS NULL AND ${table.category} IS NOT NULL)
				OR
				(${table.seasonId} IS NOT NULL AND ${table.weekId} IS NULL AND ${table.category} IS NULL)
			`,
		),
		// One winner per category per week...
		unique().on(table.weekId, table.category),
		// ...and exactly one winner per season, full stop. NULLs in a
		// unique constraint don't collide with each other in Postgres,
		// so the many week-scoped rows (seasonId always null) don't
		// conflict with this — only two actual season-scoped rows
		// sharing the same seasonId would.
		unique().on(table.seasonId),
	],
)

export type MvpAward = typeof mvpAwards.$inferSelect
export type NewMvpAward = typeof mvpAwards.$inferInsert
