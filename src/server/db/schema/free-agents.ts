import { sql } from "drizzle-orm"
import {
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"
import { teams } from "./teams"
import { users } from "./users"
import { weeks } from "./weeks"

// A player marking themselves available to be picked up by any captain
// for a specific week. Not tied to a team — that's what freeAgentInvites
// is for.
export const freeAgentAvailability = pgTable(
	"free_agent_availability",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		weekId: uuid("week_id")
			.notNull()
			.references(() => weeks.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [unique("one_offer_per_week").on(table.userId, table.weekId)],
)

export type FreeAgentAvailability = typeof freeAgentAvailability.$inferSelect
export type NewFreeAgentAvailability = typeof freeAgentAvailability.$inferInsert

export const freeAgentInvites = pgTable(
	"free_agent_invites",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teamId: uuid("team_id")
			.notNull()
			.references(() => teams.id, { onDelete: "cascade" }),
		// The free agent's availability row for the week being invited into —
		// not a raw userId/weekId pair, so an invite can't exist for a week
		// the player never opened themselves up for.
		availabilityId: uuid("availability_id")
			.notNull()
			.references(() => freeAgentAvailability.id, { onDelete: "cascade" }),
		// Optional note from the captain, shown to the free agent alongside
		// the invite.
		message: text("message"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		// null = pending, waiting on the free agent.
		// set = the free agent accepted; this is an offer, not a membership
		// yet. Same shape as teamJoinRequests — the player still has to pay
		// before a temporary team_memberships row gets created for the week.
		acceptedAt: timestamp("accepted_at"),
	},
	(table) => [
		unique("one_invite_per_team_per_offer").on(
			table.teamId,
			table.availabilityId,
		),
		// Multiple teams can invite the same free agent for the same week,
		// but only one of those invites can ever end up accepted — once a
		// player says yes to a team, the others are moot.
		uniqueIndex("one_accepted_invite_per_offer")
			.on(table.availabilityId)
			.where(sql`${table.acceptedAt} IS NOT NULL`),
	],
)

export type FreeAgentInvite = typeof freeAgentInvites.$inferSelect
export type NewFreeAgentInvite = typeof freeAgentInvites.$inferInsert
