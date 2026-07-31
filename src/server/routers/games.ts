import { TRPCError } from "@trpc/server"
import z from "zod"
import { db } from "../db"
import { getGameStatus } from "../domain/schedule"
import { publicProcedure, router } from "../trpc"

export const gamesRouter = router({
	byId: publicProcedure
		.input(z.object({ id: z.uuid() }))
		.query(async ({ input }) => {
			const game = await db.query.games.findFirst({
				where: { id: { eq: input.id } },
				with: {
					week: true,
					homeTeam: true,
					awayTeam: true,
					lineupEntries: { columns: { teamId: true } },
					// Only the most recent play is needed here — enough to know
					// whether any plays exist yet (for status) and, if so, the
					// half/inning currently in progress. Same convention as
					// weeksWithGamesForSeason in routers/seasons.ts.
					plays: {
						columns: { id: true, half: true, inning: true },
						orderBy: { sequence: "desc" },
						limit: 1,
					},
				},
			})

			if (!game) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Game not found" })
			}

			return {
				id: game.id,
				round: game.round,
				field: game.field,
				startTime: game.startTime,
				week: game.week,
				homeTeamId: game.homeTeamId,
				// homeTeamId/awayTeamId are notNull FKs, so these relations are
				// always populated — same guarantee weeksWithGamesForSeason
				// (routers/seasons.ts) leans on.
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
			}
		}),
})
