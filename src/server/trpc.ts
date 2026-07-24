import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import type { Context } from "./context"

const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
export const mergeRouters = t.mergeRouters

const isAuthed = middleware(({ ctx, next }) => {
	if (!ctx.user || !ctx.session) {
		throw new TRPCError({ code: "UNAUTHORIZED" })
	}

	return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } })
})

export const protectedProcedure = publicProcedure.use(isAuthed)

const isAdmin = middleware(({ ctx, next }) => {
	if (!ctx.user || !ctx.session) {
		throw new TRPCError({ code: "UNAUTHORIZED" })
	}

	if (!ctx.user.isAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin access required",
		})
	}

	return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } })
})

export const adminProcedure = publicProcedure.use(isAdmin)
