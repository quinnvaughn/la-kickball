import { boolean, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { teams } from "./teams"
import { users } from "./users"
import { weeks } from "./weeks"

export const teamMemberships = pgTable(
	"team_memberships",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teamId: uuid("team_id")
			.references(() => teams.id, { onDelete: "cascade" })
			.notNull(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		isCaptain: boolean("is_captain").notNull().default(false),
		// Null = a normal, season-long roster spot. Set = this membership
		// only covers that one week — a free agent a captain picked up
		// through freeAgentInvites, good for that week's game(s) only.
		weekId: uuid("week_id").references(() => weeks.id, {
			onDelete: "cascade",
		}),
		joinedAt: timestamp("joined_at").notNull().defaultNow(),
	},
	(table) => [unique().on(table.teamId, table.userId, table.weekId)],
)

export type TeamMembership = typeof teamMemberships.$inferSelect
export type NewTeamMembership = typeof teamMemberships.$inferInsert
