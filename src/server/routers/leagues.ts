import { TRPCError } from "@trpc/server"
import { eq, sql } from "drizzle-orm"
import z from "zod"
import { db } from "../db"
import { isUniqueConstraintError } from "../db/errors"
import { gameLogs, games, leagues, seasons, users, weeks } from "../db/schema"
import { slugify } from "../domain/leagues"
import { bucketSeasonsByStatus, formatSeasonName } from "../domain/seasons"
import {
	CAREER_STAT_FIELD_KEYS,
	type CareerStatsRow,
	buildCareerLeaders,
	computeCareerStats,
	paginateCareerStats,
	sortCareerStats,
	toCareerStatsPlayer,
} from "../domain/stats"
import { adminProcedure, publicProcedure, router } from "../trpc"

const editableLeagueFields = {
	name: z.string().min(1).max(200),
	locationName: z.string().min(1).max(200),
	locationUrl: z.url(),
}

const LEAGUE_SLUG_CONFLICT_MESSAGE = "A league with that slug already exists"

// Slugs are derived from the name, not chosen by the admin — "Cheviot
// Hills" -> "cheviot-hills". Falls back to "-2", "-3", ... on collision,
// though with league names this should be rare in practice.
async function generateUniqueLeagueSlug(name: string): Promise<string> {
	const base = slugify(name)
	let slug = base
	let suffix = 2

	while (await db.query.leagues.findFirst({ where: { slug: { eq: slug } } })) {
		slug = `${base}-${suffix}`
		suffix++
	}

	return slug
}

async function careerTotalsForLeague(leagueId: string) {
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
		.where(eq(seasons.leagueId, leagueId))
		.groupBy(gameLogs.userId, users.firstName, users.lastName)
}

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
					seasons: {
						with: {
							winner: true,
						},
					},
				},
			})

			if (!league) {
				throw new TRPCError({ code: "NOT_FOUND", message: "League not found" })
			}

			const totals = await careerTotalsForLeague(league.id)

			return {
				...league,
				seasons: bucketSeasonsByStatus(league.seasons),
				careerLeaders: buildCareerLeaders(totals.map(computeCareerStats)),
			}
		}),

	season: publicProcedure
		.input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
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
				with: {
					winner: true,
					teams: true,
				},
			})

			if (!season) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" })
			}

			return { ...season, name: formatSeasonName(season), league }
		}),

	careerStats: publicProcedure
		.input(
			z.object({
				slug: z.string(),
				sortBy: z.enum(CAREER_STAT_FIELD_KEYS).default("atBats"),
				sortDir: z.enum(["asc", "desc"]).default("desc"),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(25),
			}),
		)
		.query(async ({ input }) => {
			const league = await db.query.leagues.findFirst({
				where: { slug: { eq: input.slug } },
			})

			if (!league) {
				throw new TRPCError({ code: "NOT_FOUND", message: "League not found" })
			}

			const totals = await careerTotalsForLeague(league.id)
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

	create: adminProcedure
		.input(z.object(editableLeagueFields))
		.mutation(async ({ input }) => {
			try {
				const [league] = await db
					.insert(leagues)
					.values({
						...input,
						slug: await generateUniqueLeagueSlug(input.name),
					})
					.returning()
				return league
			} catch (error) {
				if (isUniqueConstraintError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: LEAGUE_SLUG_CONFLICT_MESSAGE,
					})
				}
				throw error
			}
		}),

	update: adminProcedure
		.input(
			z
				.object({ id: z.uuid(), ...editableLeagueFields })
				.partial({ name: true, locationName: true, locationUrl: true }),
		)
		.mutation(async ({ input }) => {
			const { id, ...fields } = input

			if (Object.keys(fields).length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No fields to update",
				})
			}

			const [league] = await db
				.update(leagues)
				.set({ ...fields, updatedAt: new Date() })
				.where(eq(leagues.id, id))
				.returning()

			if (!league) {
				throw new TRPCError({ code: "NOT_FOUND", message: "League not found" })
			}

			return league
		}),

	// Seasons, teams, weeks, games, and every stat/roster/free-agent row
	// underneath them cascade automatically via ON DELETE CASCADE FKs —
	// see the onDelete options across src/server/db/schema/*.ts.
	delete: adminProcedure
		.input(z.object({ id: z.uuid() }))
		.mutation(async ({ input }) => {
			const [league] = await db
				.delete(leagues)
				.where(eq(leagues.id, input.id))
				.returning()

			if (!league) {
				throw new TRPCError({ code: "NOT_FOUND", message: "League not found" })
			}

			return { ok: true }
		}),
})
