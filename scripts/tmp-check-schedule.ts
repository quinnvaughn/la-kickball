import { appRouter } from "../src/server/router"

async function main() {
	const caller = appRouter.createCaller({ user: null } as never)
	const season = await caller.seasons.bySlug({
		leagueSlug: "cheviot-hills",
		seasonSlug: "summer-2026-coed",
	})

	for (const w of season.schedule.weeks) {
		for (const g of w.games) {
			if (g.status === "in_progress") {
				console.log(JSON.stringify({ week: w.weekNumber, ...g }, null, 2))
			}
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
