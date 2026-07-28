import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm"
import z from "zod"
import { db } from "../db"
import {
	freeAgentAvailability,
	gameLogs,
	games,
	seasons,
	users,
	weeks,
} from "../db/schema"
import {
	getCaptainTeamIdForUser,
	isUserRegisteredForSeason,
} from "../domain/registration"
import { formatSeasonName } from "../domain/seasons"
import {
	buildPlayerAvailabilitySummary,
	type CareerStatsRow,
	type CareerTotals,
	computeCareerStats,
	type PlayerAvailabilitySummary,
} from "../domain/stats"
import { publicProcedure, router } from "../trpc"

// Same shape as leagues.ts's careerTotalsForLeague, but scoped to a
// specific set of players (career-wide, across every league/season
// they've suited up for) rather than to one league — the
// free-agent/weekly-sub cards want "how good has this person been
// overall," not "in this league only."
async function careerTotalsForUsers(userIds: string[]) {
	if (userIds.length === 0) return []

	return db
		.select({
			userId: gameLogs.userId,
			firstName: users.firstName,
			lastName: users.lastName,
			seasons: sql<number>`count(distinct ${seasons.id})`.mapWith(Number),
			games: sql<number>`count(distinct ${gameLogs.id})`.mapWith(Number),
			atBats: sql<number>`sum(${gameLogs.atBats})`.mapWith(Number),
			runs: sql<number>`sum(${gameLogs.runs})`.mapWith(Number),
			rki: sql<number>`sum(${gameLogs.rki})`.mapWith(Number),
			singles: sql<number>`sum(${gameLogs.singles})`.mapWith(Number),
			doubles: sql<number>`sum(${gameLogs.doubles})`.mapWith(Number),
			triples: sql<number>`sum(${gameLogs.triples})`.mapWith(Number),
			homers: sql<number>`sum(${gameLogs.homers})`.mapWith(Number),
			walks: sql<number>`sum(${gameLogs.walks})`.mapWith(Number),
			sacs: sql<number>`sum(${gameLogs.sacs})`.mapWith(Number),
			extraBasesTaken: sql<number>`sum(${gameLogs.extraBasesTaken})`.mapWith(
				Number,
			),
		})
		.from(gameLogs)
		.innerJoin(games, eq(gameLogs.gameId, games.id))
		.innerJoin(weeks, eq(games.weekId, weeks.id))
		.innerJoin(seasons, eq(weeks.seasonId, seasons.id))
		.innerJoin(users, eq(gameLogs.userId, users.id))
		.where(inArray(gameLogs.userId, userIds))
		.groupBy(gameLogs.userId, users.firstName, users.lastName)
}

const ZERO_CAREER_TOTALS = {
	atBats: 0,
	runs: 0,
	rki: 0,
	singles: 0,
	doubles: 0,
	triples: 0,
	homers: 0,
	walks: 0,
	sacs: 0,
	extraBasesTaken: 0,
} satisfies Omit<CareerTotals, "userId" | "firstName" | "lastName">

// Hydrates a list of user ids into games-played + top-stat summaries for
// the free-agent/weekly-sub cards. A user with no career game logs still
// gets a row (zeroed out) rather than being dropped, so "never played" is
// distinguishable from "not found."
async function playerAvailabilitySummariesForUsers(
	userIds: string[],
): Promise<PlayerAvailabilitySummary[]> {
	if (userIds.length === 0) return []

	const [players, totals] = await Promise.all([
		db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
			})
			.from(users)
			.where(inArray(users.id, userIds)),
		careerTotalsForUsers(userIds),
	])

	const totalsByUserId = new Map(totals.map((row) => [row.userId, row]))
	const order = new Map(userIds.map((id, index) => [id, index]))

	return players
		.map((player) => {
			const totalsRow = totalsByUserId.get(player.id) ?? {
				userId: player.id,
				firstName: player.firstName,
				lastName: player.lastName,
				seasons: 0,
				games: 0,
				...ZERO_CAREER_TOTALS,
			}

			return buildPlayerAvailabilitySummary(
				computeCareerStats(totalsRow) as CareerStatsRow,
			)
		})
		.sort((a, b) => (order.get(a.userId) ?? 0) - (order.get(b.userId) ?? 0))
}

// Every user with a free-agent-availability row for any week in the
// season, ordered by when they first signed up. This is the season-wide
// "Free Agents" pool (shown pre-season, before there's a specific week
// to be a sub for).
async function freeAgentUserIdsForSeason(seasonId: string): Promise<string[]> {
	const rows = await db
		.select({
			userId: freeAgentAvailability.userId,
			firstSignedUpAt: sql`min(${freeAgentAvailability.createdAt})`,
		})
		.from(freeAgentAvailability)
		.innerJoin(weeks, eq(freeAgentAvailability.weekId, weeks.id))
		.where(eq(weeks.seasonId, seasonId))
		.groupBy(freeAgentAvailability.userId)
		.orderBy(sql`min(${freeAgentAvailability.createdAt})`)

	return rows.map((row) => row.userId)
}

// The week closest to today within the season — during the regular
// season/playoffs this is effectively "this week," which is what the
// Weekly Subs tab is asking "available for."
async function currentWeekForSeason(seasonId: string) {
	const [week] = await db
		.select()
		.from(weeks)
		.where(and(eq(weeks.seasonId, seasonId), isNotNull(weeks.date)))
		.orderBy(sql`abs(${weeks.date} - current_date)`)
		.limit(1)

	return week ?? null
}

async function weeklySubUserIdsForWeek(weekId: string): Promise<string[]> {
	const rows = await db
		.select({ userId: freeAgentAvailability.userId })
		.from(freeAgentAvailability)
		.where(eq(freeAgentAvailability.weekId, weekId))
		.orderBy(freeAgentAvailability.createdAt)

	return rows.map((row) => row.userId)
}

export const seasonsRouter = router({
	bySlug: publicProcedure
		.input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
		.query(async ({ input, ctx }) => {
			const league = await db.query.leagues.findFirst({
				where: { slug: { eq: input.leagueSlug } },
			})

			if (!league) {
				throw new TRPCError({ code: "NOT_FOUND", message: "League not found" })
			}

			const season = await db.query.seasons.findFirst({
				where: {
					leagueId: { eq: league.id },
					slug: { eq: input.seasonSlug },
				},
				with: {
					winner: true,
					teams: true,
				},
			})

			if (!season) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" })
			}

			const [isRegistered, myCaptainTeamId, freeAgentUserIds, currentWeek] =
				await Promise.all([
					ctx.user
						? isUserRegisteredForSeason(ctx.user.id, season.id)
						: Promise.resolve(false),
					ctx.user
						? getCaptainTeamIdForUser(ctx.user.id, season.id)
						: Promise.resolve(null),
					freeAgentUserIdsForSeason(season.id),
					currentWeekForSeason(season.id),
				])

			const weeklySubUserIds = currentWeek
				? await weeklySubUserIdsForWeek(currentWeek.id)
				: []

			const [freeAgents, weeklySubs] = await Promise.all([
				playerAvailabilitySummariesForUsers(freeAgentUserIds),
				playerAvailabilitySummariesForUsers(weeklySubUserIds),
			])

			return {
				...season,
				name: formatSeasonName(season),
				league,
				isRegistered,
				myCaptainTeamId,
				freeAgents,
				weeklySubs: {
					week: currentWeek,
					players: weeklySubs,
				},
			}
		}),
})
