import { initTRPC } from "@trpc/server"
import type { Request, Response } from "express"

export interface CreateTRPCContextOptions {
	req: Request
	res: Response
}

export interface AppContext {
	req: Request
	res: Response
}

export function createTRPCContext({
	req,
	res,
}: CreateTRPCContextOptions): AppContext {
	return {
		req,
		res,
	}
}

const t = initTRPC.context<AppContext>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
export const mergeRouters = t.mergeRouters
