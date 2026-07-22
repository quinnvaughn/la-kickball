import { TRPCError } from "@trpc/server"
import z from "zod"
import { db } from "../db"
import { leagues } from "../db/schema"
import { bucketSeasonsByStatus } from "../domain/seasons"
import { publicProcedure, router } from "../trpc"

export const leaguesRouter = router({
	list: publicProcedure.query(() => db.select().from(leagues)),
	league: publicProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ input }) => {
			const league = await db.query.leagues.findFirst({
				where: {
					slug: {
						eq: input.slug,
					},
				},
				with: {
					seasons: true,
				},
			})

			if (!league) {
				throw new TRPCError({ code: "NOT_FOUND", message: "League not found" })
			}

			return {
				...league,
				seasons: bucketSeasonsByStatus(league.seasons),
			}
		}),
})
