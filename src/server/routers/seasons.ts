import { TRPCError } from "@trpc/server"
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"
import z from "zod"
import { db } from "../db"
import {
	freeAgentAvailability,
	gameLogs,
	games,
	mvpAwards,
	seasons,
	teamMemberships,
	teams,
	users,
	weeks,
} from "../db/schema"
import {
	getCaptainTeamIdForUser,
	isUserRegisteredForSeason,
} from "../domain/registration"
import {
	buildSchedule,
	getGameStatus,
	type ScheduleWeek,
	type WeekMvp,
} from "../domain/schedule"
import { formatSeasonName } from "../domain/seasons"
import { computeStandings } from "../domain/standings"
import {
	buildPlayerAvailabilitySummary,
	buildTopStats,
	type CareerStatsRow,
	type CareerTotals,
	computeCareerStats,
	type PlayerAvailabilitySummary,
	WEEK_MVP_STAT_CATEGORIES,
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

// Completed regular-season games for a season — playoff rounds and
// suspended/upcoming games (unset scores) are excluded since they shouldn't
// factor into the standings computation in domain/standings.ts. A
// suspended game still owes a makeup, so its current score doesn't count
// yet either.
async function completedRegularSeasonGamesForSeason(seasonId: string) {
	return db
		.select({
			homeTeamId: games.homeTeamId,
			awayTeamId: games.awayTeamId,
			homeScore: games.homeScore,
			awayScore: games.awayScore,
		})
		.from(games)
		.innerJoin(weeks, eq(games.weekId, weeks.id))
		.where(
			and(
				eq(weeks.seasonId, seasonId),
				eq(games.round, "regular"),
				isNotNull(games.homeScore),
				isNotNull(games.awayScore),
				isNull(games.suspendedAt),
			),
		)
}

// Each week-MVP's team plus their batting line for that week's games,
// summed in the rare case a week holds more than one game for them (e.g.
// semifinals). Team comes from the player's season-long roster spot
// (team_memberships with weekId null), scoped to the same season as the
// award's week — team_memberships is keyed on (teamId, userId, weekId),
// not (userId, weekId) alone, so without that season scope a player who's
// rostered across multiple seasons resolves to every team they've ever
// played on, not just this one. lineup_entries looked like the more
// obviously "correct" join (it's literally who played in that game) but
// it's only populated for two special-cased seed games, not regular
// completed ones, so it silently drops nearly every MVP. Scoped to a
// caller-supplied set of week ids rather than a season id so it can share
// a single query across every week already fetched by
// weeksWithGamesForSeason.
async function mvpsForWeeks(
	weekIds: string[],
): Promise<(WeekMvp & { weekId: string })[]> {
	if (weekIds.length === 0) return []

	const rows = await db
		.select({
			weekId: mvpAwards.weekId,
			userId: mvpAwards.userId,
			firstName: users.firstName,
			lastName: users.lastName,
			teamName: teams.name,
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
		.from(mvpAwards)
		.innerJoin(users, eq(users.id, mvpAwards.userId))
		.innerJoin(weeks, eq(weeks.id, mvpAwards.weekId))
		.innerJoin(
			teamMemberships,
			and(
				eq(teamMemberships.userId, mvpAwards.userId),
				isNull(teamMemberships.weekId),
			),
		)
		.innerJoin(
			teams,
			and(eq(teams.id, teamMemberships.teamId), eq(teams.seasonId, weeks.seasonId)),
		)
		.innerJoin(games, eq(games.weekId, mvpAwards.weekId))
		.innerJoin(
			gameLogs,
			and(eq(gameLogs.gameId, games.id), eq(gameLogs.userId, mvpAwards.userId)),
		)
		.where(and(inArray(mvpAwards.weekId, weekIds), isNotNull(mvpAwards.weekId)))
		.groupBy(
			mvpAwards.weekId,
			mvpAwards.userId,
			users.firstName,
			users.lastName,
			teams.name,
		)

	return rows.map((row) => {
		const stats = computeCareerStats(row)
		return {
			weekId: row.weekId as string,
			userId: row.userId,
			firstName: row.firstName,
			lastName: row.lastName,
			teamName: row.teamName,
			atBats: stats.atBats,
			hits: stats.hits,
			topStats: buildTopStats(stats, 2, WEEK_MVP_STAT_CATEGORIES),
		}
	})
}

// Every week in the season with its games (and each game's team names)
// attached, ordered by week number — the raw material for the schedule
// tab. Playoff weeks are included same as regular ones; round-specific
// filtering is a UI concern, not a query one.
async function weeksWithGamesForSeason(
	seasonId: string,
): Promise<ScheduleWeek[]> {
	const rows = await db.query.weeks.findMany({
		where: { seasonId: { eq: seasonId } },
		orderBy: { weekNumber: "asc" },
		with: {
			games: {
				with: {
					homeTeam: true,
					awayTeam: true,
					// homeScore/awayScore are already kept live by whatever logs
					// a play, so the only reason to fetch plays here is the most
					// recent one's half/inning, for a game in progress.
					plays: {
						columns: { id: true, half: true, inning: true },
						orderBy: { sequence: "desc" },
						limit: 1,
					},
				},
			},
		},
	})

	const mvpRows = await mvpsForWeeks(rows.map((week) => week.id))
	const mvpsByWeek = new Map<string, WeekMvp[]>()
	for (const { weekId, ...mvp } of mvpRows) {
		const list = mvpsByWeek.get(weekId) ?? []
		list.push(mvp)
		mvpsByWeek.set(weekId, list)
	}

	return rows.map((week) => ({
		id: week.id,
		weekNumber: week.weekNumber,
		date: week.date,
		mvps: mvpsByWeek.get(week.id) ?? [],
		games: week.games.map((game) => ({
			id: game.id,
			round: game.round,
			field: game.field,
			startTime: game.startTime,
			homeTeamId: game.homeTeamId,
			// homeTeamId/awayTeamId are notNull FKs, so these relations are
			// always populated — same guarantee completedGames leans on below.
			homeTeamName: (game.homeTeam as { name: string }).name,
			awayTeamId: game.awayTeamId,
			awayTeamName: (game.awayTeam as { name: string }).name,
			homeScore: game.homeScore,
			awayScore: game.awayScore,
			suspendedAt: game.suspendedAt,
			status: getGameStatus({
				suspendedAt: game.suspendedAt,
				endedAt: game.endedAt,
				hasPlays: game.plays.length > 0,
			}),
			half: game.plays[0]?.half ?? null,
			inning: game.plays[0]?.inning ?? null,
		})),
	}))
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

			const [
				isRegistered,
				myCaptainTeamId,
				freeAgentUserIds,
				currentWeek,
				completedGames,
				scheduleWeeks,
			] = await Promise.all([
				ctx.user
					? isUserRegisteredForSeason(ctx.user.id, season.id)
					: Promise.resolve(false),
				ctx.user
					? getCaptainTeamIdForUser(ctx.user.id, season.id)
					: Promise.resolve(null),
				freeAgentUserIdsForSeason(season.id),
				currentWeekForSeason(season.id),
				completedRegularSeasonGamesForSeason(season.id),
				weeksWithGamesForSeason(season.id),
			])

			const weeklySubUserIds = currentWeek
				? await weeklySubUserIdsForWeek(currentWeek.id)
				: []

			const [freeAgents, weeklySubs] = await Promise.all([
				playerAvailabilitySummariesForUsers(freeAgentUserIds),
				playerAvailabilitySummariesForUsers(weeklySubUserIds),
			])

			const standings = computeStandings(
				season.teams.map((team) => ({ teamId: team.id, teamName: team.name })),
				completedGames.map((game) => ({
					homeTeamId: game.homeTeamId,
					awayTeamId: game.awayTeamId,
					// Filtered to isNotNull in the query above.
					homeScore: game.homeScore as number,
					awayScore: game.awayScore as number,
				})),
			)

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
				standings,
				schedule: buildSchedule(scheduleWeeks),
			}
		}),
})
