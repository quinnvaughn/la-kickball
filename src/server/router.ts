import type { inferRouterOutputs } from "@trpc/server"
import { z } from "zod"
import { authRouter } from "./routers/auth"
import { leaguesRouter } from "./routers/leagues"
import { publicProcedure, router } from "./trpc"

export const appRouter = router({
	healthcheck: publicProcedure
		.input(
			z.object({
				name: z.string().optional(),
			}),
		)
		.query(({ input }) => ({
			ok: true,
			message: input.name ? `Hello, ${input.name}` : "Hello from tRPC",
		})),
	auth: authRouter,
	leagues: leaguesRouter,
})

export type AppRouter = typeof appRouter
export type RouterOutputs = inferRouterOutputs<AppRouter>
