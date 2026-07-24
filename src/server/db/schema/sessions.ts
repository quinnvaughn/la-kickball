import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),

	// SHA-256 hex digest of the session token, not the token itself — the
	// raw token only ever lives in the user's cookie, so a DB leak alone
	// can't be used to impersonate a session.
	tokenHash: text("token_hash").notNull().unique(),

	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),

	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
