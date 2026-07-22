import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const leagues = pgTable("leagues", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	locationName: text("location_name").notNull(),
	locationUrl: text("location_url"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
