export interface CareerTotals {
	userId: string
	firstName: string
	lastName: string
	atBats: number
	runs: number
	rki: number
	singles: number
	doubles: number
	triples: number
	homers: number
	walks: number
	sacs: number
	extraBasesTaken: number
}

export interface CareerStats extends CareerTotals {
	hits: number
	average: number
	slugging: number
	onBasePercentage: number
	ops: number
}

export function computeCareerStats(totals: CareerTotals): CareerStats {
	const hits = totals.singles + totals.doubles + totals.triples + totals.homers
	const totalBases =
		totals.singles + totals.doubles * 2 + totals.triples * 3 + totals.homers * 4
	const onBaseDenominator = totals.atBats + totals.walks + totals.sacs

	const average = totals.atBats > 0 ? hits / totals.atBats : 0
	const slugging = totals.atBats > 0 ? totalBases / totals.atBats : 0
	const onBasePercentage =
		onBaseDenominator > 0 ? (hits + totals.walks) / onBaseDenominator : 0

	return {
		...totals,
		hits,
		average,
		slugging,
		onBasePercentage,
		ops: onBasePercentage + slugging,
	}
}

export const LEADER_CATEGORIES = [
	"average",
	"slugging",
	"onBasePercentage",
	"ops",
	"hits",
	"homers",
	"rki",
	"runs",
	"doubles",
	"triples",
	"walks",
	"sacs",
	"extraBasesTaken",
] as const

export type LeaderCategory = (typeof LEADER_CATEGORIES)[number]

// Rate stats (average/slugging/OBP/OPS) blow up on tiny samples — a
// player who went 1-for-1 shouldn't outrank a season-long .400 hitter.
// This mirrors the kind of qualifying threshold real leaderboards use
// (e.g. MLB's plate-appearance minimum); the exact number is a judgment
// call, not a derived value.
export const MIN_AT_BATS_FOR_RATE_LEADERS = 10

const RATE_CATEGORIES: ReadonlySet<LeaderCategory> = new Set([
	"average",
	"slugging",
	"onBasePercentage",
	"ops",
])

export type CareerLeaders = Record<LeaderCategory, CareerStats | null>

export function buildCareerLeaders(stats: CareerStats[]): CareerLeaders {
	const leaders = {} as CareerLeaders

	for (const category of LEADER_CATEGORIES) {
		const eligible = RATE_CATEGORIES.has(category)
			? stats.filter((s) => s.atBats >= MIN_AT_BATS_FOR_RATE_LEADERS)
			: stats

		leaders[category] = eligible.reduce<CareerStats | null>(
			(leader, candidate) =>
				!leader || candidate[category] > leader[category] ? candidate : leader,
			null,
		)
	}

	return leaders
}
