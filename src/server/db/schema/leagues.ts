import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const leagues = pgTable("leagues", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	locationName: text("location_name").notNull(),
	locationUrl: text("location_url").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type League = typeof leagues.$inferSelect
export type NewLeague = typeof leagues.$inferInsert
