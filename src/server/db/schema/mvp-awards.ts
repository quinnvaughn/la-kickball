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
		weekId: uuid("week_id").references(() => weeks.id, {
			onDelete: "cascade",
		}),
		seasonId: uuid("season_id").references(() => seasons.id, {
			onDelete: "cascade",
		}),

		// Always required, but what it distinguishes depends on scope: for
		// a week award, "guy" / "girl" for a coed week's two winners,
		// "mvp" for a mens week's single winner (no gender split there);
		// for a season award, "regular" or "playoff" — a season crowns one
		// MVP for its regular season and, once the final's been played, a
		// separate one for its playoff run.
		category: text("category").notNull(),

		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// Either a week award (weekId set) or a season award (seasonId
		// set) — never both, never neither. category is required either
		// way (enforced by the column's NOT NULL above).
		check(
			"scope_matches_category",
			sql`
				(${table.weekId} IS NOT NULL AND ${table.seasonId} IS NULL)
				OR
				(${table.seasonId} IS NOT NULL AND ${table.weekId} IS NULL)
			`,
		),
		// One winner per category per week...
		unique().on(table.weekId, table.category),
		// ...and one winner per category per season — "regular" and
		// "playoff" each get their own row, but only one of each.
		unique().on(table.seasonId, table.category),
	],
)

export type MvpAward = typeof mvpAwards.$inferSelect
export type NewMvpAward = typeof mvpAwards.$inferInsert
