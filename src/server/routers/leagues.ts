import { db } from "../db"
import { leagues } from "../db/schema"
import { publicProcedure, router } from "../trpc"

export const leaguesRouter = router({
	list: publicProcedure.query(() => db.select().from(leagues)),
})
