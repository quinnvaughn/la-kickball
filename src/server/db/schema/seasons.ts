import {
	type AnyPgColumn,
	date,
	pgEnum,
	pgTable,
	smallint,
	text,
	time,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core"
import { leagues } from "./leagues"
import { teams } from "./teams"

export const seasonDivisionEnum = pgEnum("season_division", ["coed", "mens"])

export const seasonNameEnum = pgEnum("season_name", [
	"winter",
	"spring",
	"summer",
	"fall",
])

export const dayOfWeekEnum = pgEnum("day_of_week", [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
])

export const seasons = pgTable(
	"seasons",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		season: seasonNameEnum("season").notNull(),
		year: smallint("year").notNull(),
		division: seasonDivisionEnum("division").notNull(),
		slug: text("slug").notNull(),
		leagueId: uuid("league_id")
			.notNull()
			.references(() => leagues.id, { onDelete: "cascade" }),
		dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
		startTime: time("start_time"),
		endTime: time("end_time"),
		startDate: date("start_date"),
		weeks: smallint("weeks").notNull().default(8),

		winnerId: uuid("winner_id").references((): AnyPgColumn => teams.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.leagueId, table.slug)],
)

export type Season = typeof seasons.$inferSelect
export type NewSeason = typeof seasons.$inferInsert
