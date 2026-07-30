import { TRPCError } from "@trpc/server"
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm"
import z from "zod"
import { db } from "../db"
import { isUniqueConstraintError } from "../db/errors"
import {
	freeAgentAvailability,
	freeAgentInvites,
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
	isUserOnTeamForWeek,
	isUserRegisteredForSeason,
} from "../domain/registration"
import {
	buildSchedule,
	getGameStatus,
	type ScheduleWeek,
	type SeasonMvp,
	type WeekMvp,
} from "../domain/schedule"
import { formatSeasonName } from "../domain/seasons"
import { computeStandings } from "../domain/standings"
import {
	buildCareerLeaders,
	buildPlayerAvailabilitySummary,
	buildTopStats,
	CAREER_STAT_FIELD_KEYS,
	type CareerStatsRow,
	type CareerTotals,
	computeCareerStats,
	type FreeAgentListing,
	type PlayerAvailabilitySummary,
	paginateCareerStats,
	sortCareerStats,
	toCareerStatsPlayer,
	WEEK_MVP_STAT_CATEGORIES,
	type WeeklySubs,
} from "../domain/stats"
import { protectedProcedure, publicProcedure, router } from "../trpc"

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

// Same shape as leagues.ts's careerTotalsForLeague, but scoped to a single
// season instead of every season in a league — drives the season-leaders
// cards and the season's full stats table.
async function seasonTotalsForSeason(seasonId: string) {
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
		.where(eq(seasons.id, seasonId))
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

// The week whose game date falls within the current Sunday-Saturday
// span — during the regular season/playoffs this is effectively "this
// week," which is what the Weekly Subs tab is asking "available for."
// Weeks run Sunday-Saturday regardless of which day games are actually
// played on, so this is a fixed calendar-week lookup, not "nearest game
// date" (that would drift the rollover day depending on the season's
// day of week).
async function currentWeekForSeason(seasonId: string) {
	// Postgres's date_trunc('week', ...) truncates to Monday; shifting the
	// input forward a day before truncating (and back a day after) turns
	// that into a Sunday-anchored start-of-week.
	const startOfWeek = sql`date_trunc('week', current_date + 1) - interval '1 day'`

	const [week] = await db
		.select()
		.from(weeks)
		.where(
			and(
				eq(weeks.seasonId, seasonId),
				isNotNull(weeks.date),
				gte(weeks.date, sql`(${startOfWeek})::date`),
				lt(weeks.date, sql`(${startOfWeek} + interval '7 days')::date`),
			),
		)
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
			and(
				eq(teams.id, teamMemberships.teamId),
				eq(teams.seasonId, weeks.seasonId),
			),
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

// Every round that counts as "playoff" rather than regular-season — used
// to scope a playoff MVP's batting line to just those games.
const PLAYOFF_ROUNDS = ["quarterfinal", "semifinal", "final"] as const

// The season's regular-season or playoff MVP (mvp_awards row with
// seasonId set, category "regular" or "playoff" — see
// db/schema/mvp-awards.ts) plus their batting line summed across every
// game they logged in that scope, not just one week's. games is included
// since a playoff run isn't a fixed length (2 games with a bye, 3
// otherwise). The unique(seasonId, category) constraint guarantees at
// most one row per category, so null just means the league hasn't named
// that one yet. Team join follows the same season-scoped
// team_memberships convention as mvpsForWeeks.
async function seasonMvpForSeason(
	seasonId: string,
	category: "regular" | "playoff",
): Promise<SeasonMvp | null> {
	const roundFilter =
		category === "regular"
			? eq(games.round, "regular")
			: inArray(games.round, PLAYOFF_ROUNDS)

	const [row] = await db
		.select({
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
		.innerJoin(
			teamMemberships,
			and(
				eq(teamMemberships.userId, mvpAwards.userId),
				isNull(teamMemberships.weekId),
			),
		)
		.innerJoin(
			teams,
			and(eq(teams.id, teamMemberships.teamId), eq(teams.seasonId, seasonId)),
		)
		.innerJoin(weeks, eq(weeks.seasonId, seasonId))
		.innerJoin(games, and(eq(games.weekId, weeks.id), roundFilter))
		.innerJoin(
			gameLogs,
			and(eq(gameLogs.gameId, games.id), eq(gameLogs.userId, mvpAwards.userId)),
		)
		.where(
			and(eq(mvpAwards.seasonId, seasonId), eq(mvpAwards.category, category)),
		)
		.groupBy(mvpAwards.userId, users.firstName, users.lastName, teams.name)

	if (!row) return null

	const stats = computeCareerStats(row)
	return {
		userId: row.userId,
		firstName: row.firstName,
		lastName: row.lastName,
		teamName: row.teamName,
		games: row.games,
		atBats: stats.atBats,
		hits: stats.hits,
		topStats: buildTopStats(stats, 2, WEEK_MVP_STAT_CATEGORIES),
	}
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
					// Just enough to know, per side, whether a lineup exists at
					// all — drives the captain-facing "Set lineup" prompt.
					lineupEntries: {
						columns: { teamId: true },
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
			homeLineupSet: game.lineupEntries.some(
				(entry) => entry.teamId === game.homeTeamId,
			),
			awayLineupSet: game.lineupEntries.some(
				(entry) => entry.teamId === game.awayTeamId,
			),
		})),
	}))
}

async function weeklySubAvailabilityForWeek(
	weekId: string,
): Promise<{ userId: string; availabilityId: string }[]> {
	return db
		.select({
			userId: freeAgentAvailability.userId,
			availabilityId: freeAgentAvailability.id,
		})
		.from(freeAgentAvailability)
		.where(eq(freeAgentAvailability.weekId, weekId))
		.orderBy(freeAgentAvailability.createdAt)
}

// The earliest availability row per user within the season — the same
// "first signed up" row freeAgentUserIdsForSeason orders by. A free-agent
// (season-long) invite isn't tied to any one week the way a weekly-sub
// invite is, so it attaches to this row instead.
async function firstAvailabilityIdsForUsers(
	userIds: string[],
	seasonId: string,
): Promise<Map<string, string>> {
	if (userIds.length === 0) return new Map()

	const rows = await db
		.select({
			userId: freeAgentAvailability.userId,
			availabilityId: freeAgentAvailability.id,
			createdAt: freeAgentAvailability.createdAt,
		})
		.from(freeAgentAvailability)
		.innerJoin(weeks, eq(freeAgentAvailability.weekId, weeks.id))
		.where(
			and(
				inArray(freeAgentAvailability.userId, userIds),
				eq(weeks.seasonId, seasonId),
			),
		)

	const firstByUser = new Map<
		string,
		{ availabilityId: string; createdAt: Date }
	>()
	for (const row of rows) {
		const existing = firstByUser.get(row.userId)
		if (!existing || row.createdAt < existing.createdAt) {
			firstByUser.set(row.userId, {
				availabilityId: row.availabilityId,
				createdAt: row.createdAt,
			})
		}
	}

	return new Map(
		[...firstByUser].map(([userId, row]) => [userId, row.availabilityId]),
	)
}

// Which of the given availability rows a team has already sent an invite
// for — drives the "already invited" state on free-agent/weekly-sub cards.
async function invitedAvailabilityIdsForTeam(
	teamId: string,
	availabilityIds: string[],
): Promise<Set<string>> {
	if (availabilityIds.length === 0) return new Set()

	const rows = await db
		.select({ availabilityId: freeAgentInvites.availabilityId })
		.from(freeAgentInvites)
		.where(
			and(
				eq(freeAgentInvites.teamId, teamId),
				inArray(freeAgentInvites.availabilityId, availabilityIds),
			),
		)

	return new Set(rows.map((row) => row.availabilityId))
}

// Attaches each player's availability row and this team's invite state to
// their summary. Players are dropped (not just left incomplete) if no
// availability row is found for them, which shouldn't happen since the ids
// passed in are always sourced from the same availability table.
function toFreeAgentListings(
	players: PlayerAvailabilitySummary[],
	availabilityIdsByUser: Map<string, string>,
	invitedAvailabilityIds: Set<string>,
): FreeAgentListing[] {
	return players.flatMap((player) => {
		const availabilityId = availabilityIdsByUser.get(player.userId)
		if (!availabilityId) return []

		return [
			{
				...player,
				availabilityId,
				invited: invitedAvailabilityIds.has(availabilityId),
			},
		]
	})
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
				seasonTotals,
				regularSeasonMvp,
				playoffMvp,
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
				seasonTotalsForSeason(season.id),
				seasonMvpForSeason(season.id, "regular"),
				seasonMvpForSeason(season.id, "playoff"),
			])

			const weeklySubAvailability = currentWeek
				? await weeklySubAvailabilityForWeek(currentWeek.id)
				: []
			const weeklySubUserIds = weeklySubAvailability.map((row) => row.userId)

			const [freeAgents, weeklySubs, freeAgentAvailabilityIds] =
				await Promise.all([
					playerAvailabilitySummariesForUsers(freeAgentUserIds),
					playerAvailabilitySummariesForUsers(weeklySubUserIds),
					firstAvailabilityIdsForUsers(freeAgentUserIds, season.id),
				])

			const weeklySubAvailabilityIds = new Map(
				weeklySubAvailability.map((row) => [row.userId, row.availabilityId]),
			)

			const viewerHasOpenAvailability = ctx.user
				? weeklySubAvailabilityIds.has(ctx.user.id)
				: false

			const viewerIsOnTeamForWeek =
				ctx.user && currentWeek
					? await isUserOnTeamForWeek(ctx.user.id, currentWeek.id, season.id)
					: false

			const invitedAvailabilityIds = myCaptainTeamId
				? await invitedAvailabilityIdsForTeam(myCaptainTeamId, [
						...freeAgentAvailabilityIds.values(),
						...weeklySubAvailabilityIds.values(),
					])
				: new Set<string>()

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
				freeAgents: toFreeAgentListings(
					freeAgents,
					freeAgentAvailabilityIds,
					invitedAvailabilityIds,
				),
				weeklySubs: {
					week: currentWeek,
					players: toFreeAgentListings(
						weeklySubs,
						weeklySubAvailabilityIds,
						invitedAvailabilityIds,
					),
					viewerIsOnTeamForWeek,
					viewerHasOpenAvailability,
				} satisfies WeeklySubs,
				standings,
				schedule: buildSchedule(scheduleWeeks),
				seasonLeaders: buildCareerLeaders(seasonTotals.map(computeCareerStats)),
				regularSeasonMvp,
				playoffMvp,
			}
		}),

	stats: publicProcedure
		.input(
			z.object({
				leagueSlug: z.string(),
				seasonSlug: z.string(),
				sortBy: z.enum(CAREER_STAT_FIELD_KEYS).default("atBats"),
				sortDir: z.enum(["asc", "desc"]).default("desc"),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(25),
			}),
		)
		.query(async ({ input }) => {
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
			})

			if (!season) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" })
			}

			const totals = await seasonTotalsForSeason(season.id)
			const rows: CareerStatsRow[] = totals.map(computeCareerStats)

			const sorted = sortCareerStats(rows, input.sortBy, input.sortDir)
			const total = sorted.length
			const totalPages = Math.max(1, Math.ceil(total / input.pageSize))
			const page = Math.min(input.page, totalPages)

			return {
				players: paginateCareerStats(sorted, page, input.pageSize).map(
					toCareerStatsPlayer,
				),
				total,
				page,
				pageSize: input.pageSize,
				totalPages,
			}
		}),

	sendFreeAgentInvite: protectedProcedure
		.input(
			z.object({
				teamId: z.string(),
				availabilityId: z.string(),
				message: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const team = await db.query.teams.findFirst({
				where: { id: { eq: input.teamId } },
			})

			if (!team) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" })
			}

			const captainTeamId = await getCaptainTeamIdForUser(
				ctx.user.id,
				team.seasonId,
			)

			if (captainTeamId !== input.teamId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only this team's captain can send invites.",
				})
			}

			try {
				const [invite] = await db
					.insert(freeAgentInvites)
					.values({
						teamId: input.teamId,
						availabilityId: input.availabilityId,
						message: input.message,
					})
					.returning()

				return invite
			} catch (error) {
				if (isUniqueConstraintError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You've already invited this player.",
					})
				}

				throw error
			}
		}),

	// A player opening themselves up to be picked up as a weekly sub for
	// the season's current (Sunday-Saturday) week — the same
	// freeAgentAvailability row a season-long free-agent signup uses, just
	// scoped to this one week instead of picked up later by
	// freeAgentUserIdsForSeason.
	markAvailableForWeek: protectedProcedure
		.input(z.object({ seasonId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const currentWeek = await currentWeekForSeason(input.seasonId)

			if (!currentWeek) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No week is currently open for weekly subs.",
				})
			}

			try {
				const [availability] = await db
					.insert(freeAgentAvailability)
					.values({
						userId: ctx.user.id,
						weekId: currentWeek.id,
					})
					.returning()

				return availability
			} catch (error) {
				if (isUniqueConstraintError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You've already marked yourself available for this week.",
					})
				}

				throw error
			}
		}),
})
