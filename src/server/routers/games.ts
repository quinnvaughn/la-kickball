import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import z from "zod"
import { db } from "../db"
import { games } from "../db/schema"
import { buildPlayLog } from "../domain/game-plays"
import { getGameStatus } from "../domain/schedule"
import { toBoxScorePlayer } from "../domain/stats"
import { adminProcedure, publicProcedure, router } from "../trpc"

export const gamesRouter = router({
	byId: publicProcedure
		.input(z.object({ id: z.uuid() }))
		.query(async ({ input, ctx }) => {
			const game = await db.query.games.findFirst({
				where: { id: { eq: input.id } },
				with: {
					week: true,
					homeTeam: {
						with: {
							memberships: { columns: { userId: true, weekId: true } },
						},
					},
					awayTeam: {
						with: {
							memberships: { columns: { userId: true, weekId: true } },
						},
					},
					ref: true,
					lineupEntries: {
						columns: { teamId: true, battingOrder: true },
						with: {
							user: { columns: { id: true, firstName: true, lastName: true } },
						},
						orderBy: { battingOrder: "asc" },
					},
					// The full play-by-play, oldest first — both for the game log
					// itself and (via the last element) to know whether any
					// plays exist yet and what half/inning is currently in
					// progress, the same status signal weeksWithGamesForSeason
					// (routers/seasons.ts) uses.
					plays: {
						columns: {
							id: true,
							sequence: true,
							outcome: true,
							half: true,
							inning: true,
							runnerEvents: true,
						},
						orderBy: { sequence: "asc" },
						with: {
							batter: { columns: { id: true, firstName: true, lastName: true } },
						},
					},
					logs: {
						columns: {
							userId: true,
							atBats: true,
							runs: true,
							rki: true,
							singles: true,
							doubles: true,
							triples: true,
							homers: true,
							walks: true,
							sacs: true,
							extraBasesTaken: true,
						},
						with: {
							user: { columns: { firstName: true, lastName: true } },
						},
					},
				},
			})

			if (!game) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" })
			}

			const toLineup = (teamId: string) =>
				game.lineupEntries
					.filter((entry) => entry.teamId === teamId)
					.map((entry) => ({
						battingOrder: entry.battingOrder,
						// userId is a notNull FK, so this relation is always populated.
						player: entry.user as {
							id: string
							firstName: string
							lastName: string
						},
					}))

			// A game_logs row has no teamId of its own — a player's team for
			// this game comes from team_memberships instead, since a
			// completed game's lineup_entries rows aren't guaranteed to
			// stick around (this seed's historical games have none).
			// Season-long rosters (weekId null) are resolved first, then
			// this week's pickups/subs (weekId matching the game's week)
			// override them, since a sub's assignment is more specific.
			const memberships = [
				...(game.homeTeam as { memberships: { userId: string; weekId: string | null }[] })
					.memberships.map((m) => ({ ...m, teamId: game.homeTeamId })),
				...(game.awayTeam as { memberships: { userId: string; weekId: string | null }[] })
					.memberships.map((m) => ({ ...m, teamId: game.awayTeamId })),
			]
			const teamIdByUserId = new Map<string, string>()
			for (const m of memberships) {
				if (m.weekId === null) teamIdByUserId.set(m.userId, m.teamId)
			}
			for (const m of memberships) {
				if (m.weekId === game.weekId) teamIdByUserId.set(m.userId, m.teamId)
			}

			const battingOrderByUserId = new Map(
				game.lineupEntries.map((entry) => [
					(entry.user as { id: string }).id,
					entry.battingOrder,
				]),
			)

			const toBoxScore = (teamId: string) =>
				game.logs
					.filter((log) => teamIdByUserId.get(log.userId) === teamId)
					.map((log) =>
						toBoxScorePlayer({
							userId: log.userId,
							// userId is a notNull FK, so this relation is always populated.
							firstName: (log.user as { firstName: string }).firstName,
							lastName: (log.user as { lastName: string }).lastName,
							atBats: log.atBats,
							runs: log.runs,
							rki: log.rki,
							singles: log.singles,
							doubles: log.doubles,
							triples: log.triples,
							homers: log.homers,
							walks: log.walks,
							sacs: log.sacs,
							extraBasesTaken: log.extraBasesTaken,
						}),
					)
					.sort(
						(a, b) =>
							(battingOrderByUserId.get(a.userId) ?? Number.POSITIVE_INFINITY) -
							(battingOrderByUserId.get(b.userId) ?? Number.POSITIVE_INFINITY),
					)

			// homeTeamId/awayTeamId are notNull FKs, so these relations are
			// always populated — same guarantee weeksWithGamesForSeason
			// (routers/seasons.ts) leans on.
			const homeTeamName = (game.homeTeam as { name: string }).name
			const awayTeamName = (game.awayTeam as { name: string }).name
			const status = getGameStatus({
				suspendedAt: game.suspendedAt,
				endedAt: game.endedAt,
				hasPlays: game.plays.length > 0,
			})

			return {
				id: game.id,
				round: game.round,
				field: game.field,
				startTime: game.startTime,
				week: game.week,
				homeTeamId: game.homeTeamId,
				homeTeamName,
				awayTeamId: game.awayTeamId,
				awayTeamName,
				homeScore: game.homeScore,
				awayScore: game.awayScore,
				suspendedAt: game.suspendedAt,
				status,
				half: game.plays.at(-1)?.half ?? null,
				inning: game.plays.at(-1)?.inning ?? null,
				// Grouped by half-inning, most recent first — see
				// domain/game-plays.ts buildPlayLog for the shape.
				halfInnings: buildPlayLog(
					game.plays.map((play) => ({
						id: play.id,
						sequence: play.sequence,
						outcome: play.outcome,
						half: play.half,
						inning: play.inning,
						runnerEvents: play.runnerEvents,
						batter: play.batter as { id: string; firstName: string; lastName: string },
					})),
					{
						homeTeamId: game.homeTeamId,
						homeTeamName,
						awayTeamId: game.awayTeamId,
						awayTeamName,
					},
					status === "in_progress",
				),
				refId: game.refId,
				ref: game.ref as {
					id: string
					firstName: string
					lastName: string
				} | null,
				// Whether the signed-in viewer is the ref assigned to this game.
				viewerIsAssignedRef: ctx.user ? ctx.user.id === game.refId : false,
				homeLineup: toLineup(game.homeTeamId),
				awayLineup: toLineup(game.awayTeamId),
				homeLineupSet: game.lineupEntries.some(
					(entry) => entry.teamId === game.homeTeamId,
				),
				awayLineupSet: game.lineupEntries.some(
					(entry) => entry.teamId === game.awayTeamId,
				),
				homeBoxScore: toBoxScore(game.homeTeamId),
				awayBoxScore: toBoxScore(game.awayTeamId),
			}
		}),

	// Assign (or clear, with userId: null) the ref for a game. The ref
	// must already be in that game's season's referee pool — see
	// seasons.addReferee.
	assignRef: adminProcedure
		.input(z.object({ gameId: z.uuid(), userId: z.uuid().nullable() }))
		.mutation(async ({ input }) => {
			const game = await db.query.games.findFirst({
				where: { id: { eq: input.gameId } },
				with: { week: { columns: { seasonId: true } } },
			})

			if (!game) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" })
			}

			if (input.userId) {
				const referee = await db.query.seasonReferees.findFirst({
					where: {
						// week is a notNull FK, so this relation is always populated.
						seasonId: { eq: (game.week as { seasonId: string }).seasonId },
						userId: { eq: input.userId },
					},
				})

				if (!referee) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "This person isn't a referee for this game's season.",
					})
				}
			}

			const [updated] = await db
				.update(games)
				.set({ refId: input.userId, updatedAt: new Date() })
				.where(eq(games.id, input.gameId))
				.returning()

			return updated
		}),
})
