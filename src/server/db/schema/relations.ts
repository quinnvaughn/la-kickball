import { defineRelations } from "drizzle-orm"
import { leagues } from "./leagues"
import { seasons } from "./seasons"

const schema = { leagues, seasons }

export const relations = defineRelations(schema, (r) => ({
	leagues: {
		seasons: r.many.seasons({
			from: r.leagues.id,
			to: r.seasons.leagueId,
		}),
	},
	seasons: {
		league: r.one.leagues({
			from: r.seasons.leagueId,
			to: r.leagues.id,
		}),
	},
}))
