import { z } from "zod";
import { publicProcedure, router } from "./trpc";

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
});

export type AppRouter = typeof appRouter;
