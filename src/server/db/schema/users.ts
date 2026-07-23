import {
	boolean,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),

	firstName: varchar("first_name", { length: 60 }).notNull(),
	lastName: varchar("last_name", { length: 60 }).notNull(),

	email: varchar("email", { length: 255 }).notNull().unique(),
	phone: varchar("phone", { length: 20 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),

	bio: text("bio"),
	location: varchar("location", { length: 100 }),

	isAdmin: boolean("is_admin").notNull().default(false),
	isRef: boolean("is_ref").notNull().default(false),

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
