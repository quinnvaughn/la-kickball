import { and, eq, isNull } from "drizzle-orm"
import { db } from "../db"
import {
	freeAgentAvailability,
	teamMemberships,
	teams,
	weeks,
} from "../db/schema"

// "Registered" means either a season-long roster spot (a team_memberships
// row with no weekId — a non-null weekId is a one-off weekly-sub pickup, not
// season registration) or having opened yourself up as a free agent for any
// week in the season.
//
// Deliberately kept out of ../domain/seasons.ts: that file is imported
// (type-only) from client-facing components, and Vite's dep scanner pulls in
// this file's real `db` import (and the `postgres` driver behind it, which
// touches Buffer) even for a type-only importer — breaking the client
// bundle. This file must never be imported, even for types, from anything
// client-reachable.
export async function isUserRegisteredForSeason(
	userId: string,
	seasonId: string,
): Promise<boolean> {
	const [membership] = await db
		.select({ id: teamMemberships.id })
		.from(teamMemberships)
		.innerJoin(teams, eq(teamMemberships.teamId, teams.id))
		.where(
			and(
				eq(teamMemberships.userId, userId),
				isNull(teamMemberships.weekId),
				eq(teams.seasonId, seasonId),
			),
		)
		.limit(1)

	if (membership) return true

	const [availability] = await db
		.select({ id: freeAgentAvailability.id })
		.from(freeAgentAvailability)
		.innerJoin(weeks, eq(freeAgentAvailability.weekId, weeks.id))
		.where(
			and(
				eq(freeAgentAvailability.userId, userId),
				eq(weeks.seasonId, seasonId),
			),
		)
		.limit(1)

	return !!availability
}
