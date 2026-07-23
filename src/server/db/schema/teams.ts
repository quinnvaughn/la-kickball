import { boolean, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core"
import { seasons } from "./seasons"

export const teams = pgTable("teams", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	seasonId: uuid("season_id")
		.notNull()
		.references(() => seasons.id),
	description: text("description"),
	isOpen: boolean("is_open").notNull(),
	inviteCode: varchar("invite_code", { length: 6 }),
})

export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
