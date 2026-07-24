import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { teams } from "./teams"

export const teamJoinRequests = pgTable(
	"team_join_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teamId: uuid("team_id")
			.references(() => teams.id, { onDelete: "cascade" })
			.notNull(),
		playerId: uuid("player_id").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		// null = pending, waiting on the captain.
		// set = the captain accepted; this is an offer, not a membership yet.
		// The player still has to choose it and pay before team_memberships
		// gets a row.
		acceptedAt: timestamp("accepted_at"),
	},
	(table) => [unique("one_request_per_team").on(table.teamId, table.playerId)],
)

export type TeamJoinRequest = typeof teamJoinRequests.$inferSelect
