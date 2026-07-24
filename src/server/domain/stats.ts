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
	avg: number
	slg: number
	obp: number
	ops: number
}

export function computeCareerStats<T extends CareerTotals>(
	totals: T,
): T & Omit<CareerStats, keyof CareerTotals> {
	const hits = totals.singles + totals.doubles + totals.triples + totals.homers
	const totalBases =
		totals.singles + totals.doubles * 2 + totals.triples * 3 + totals.homers * 4
	const onBaseDenominator = totals.atBats + totals.walks + totals.sacs

	const avg = totals.atBats > 0 ? hits / totals.atBats : 0
	const slg = totals.atBats > 0 ? totalBases / totals.atBats : 0
	const obp =
		onBaseDenominator > 0 ? (hits + totals.walks) / onBaseDenominator : 0

	return {
		...totals,
		hits,
		avg,
		slg,
		obp,
		ops: obp + slg,
	}
}

export const LEADER_CATEGORIES = [
	"hits",
	"singles",
	"doubles",
	"triples",
	"homers",
	"runs",
	"rki",
	"walks",
	"sacs",
	"extraBasesTaken",
	"avg",
	"obp",
	"slg",
	"ops",
] as const

export type LeaderCategory = (typeof LEADER_CATEGORIES)[number]

// Rate stats (average/slugging/OBP/OPS) blow up on tiny samples — a
// player who went 1-for-1 shouldn't outrank a season-long .400 hitter.
// This mirrors the kind of qualifying threshold real leaderboards use
// (e.g. MLB's plate-appearance minimum); the exact number is a judgment
// call, not a derived value.
export const MIN_AT_BATS_FOR_RATE_LEADERS = 10

const RATE_CATEGORIES: ReadonlySet<LeaderCategory> = new Set([
	"avg",
	"slg",
	"obp",
	"ops",
])

export function isRateCategory(category: LeaderCategory): boolean {
	return RATE_CATEGORIES.has(category)
}

export interface CareerLeader {
	stat: LeaderCategory
	value: number
	userId: string
	firstName: string
	lastName: string
}

export function buildCareerLeaders(stats: CareerStats[]): CareerLeader[] {
	return LEADER_CATEGORIES.map((category) => {
		const eligible = RATE_CATEGORIES.has(category)
			? stats.filter((s) => s.atBats >= MIN_AT_BATS_FOR_RATE_LEADERS)
			: stats

		const leader = eligible.reduce<CareerStats | null>(
			(leader, candidate) =>
				!leader || candidate[category] > leader[category] ? candidate : leader,
			null,
		)

		return leader
			? {
					stat: category,
					value: leader[category],
					userId: leader.userId,
					firstName: leader.firstName,
					lastName: leader.lastName,
				}
			: null
	}).filter((leader) => leader !== null)
}

// A player's career totals plus how many seasons/games they've suited
// up for — the two counts don't come from gameLogs sums like everything
// else, they're distinct counts over seasons/games joined in.
export interface CareerStatsRow extends CareerStats {
	seasons: number
	games: number
}

// Drives both the sortable column set on the career stats table and the
// label shown in its header — order here is display order.
export const CAREER_STAT_FIELDS = [
	{ key: "seasons", label: "Seasons" },
	{ key: "games", label: "G" },
	{ key: "atBats", label: "AB" },
	{ key: "runs", label: "R" },
	{ key: "hits", label: "H" },
	{ key: "singles", label: "1B" },
	{ key: "doubles", label: "2B" },
	{ key: "triples", label: "3B" },
	{ key: "homers", label: "HR" },
	{ key: "rki", label: "RKI" },
	{ key: "walks", label: "BB" },
	{ key: "sacs", label: "SAC" },
	{ key: "extraBasesTaken", label: "XBT" },
	{ key: "avg", label: "AVG" },
	{ key: "obp", label: "OBP" },
	{ key: "slg", label: "SLG" },
	{ key: "ops", label: "OPS" },
] as const satisfies readonly { key: keyof CareerStatsRow; label: string }[]

export type CareerStatField = (typeof CAREER_STAT_FIELDS)[number]["key"]

export const CAREER_STAT_FIELD_KEYS = CAREER_STAT_FIELDS.map(
	(field) => field.key,
) as [CareerStatField, ...CareerStatField[]]

export interface CareerStatEntry {
	key: CareerStatField
	label: string
	value: number
}

export interface CareerStatsPlayer {
	userId: string
	firstName: string
	lastName: string
	stats: CareerStatEntry[]
}

// The UI maps over this array rather than reading named fields off the
// row, so a new column is just a new entry in CAREER_STAT_FIELDS.
export function buildCareerStatEntries(row: CareerStatsRow): CareerStatEntry[] {
	return CAREER_STAT_FIELDS.map(({ key, label }) => ({
		key,
		label,
		value: row[key],
	}))
}

export function toCareerStatsPlayer(row: CareerStatsRow): CareerStatsPlayer {
	return {
		userId: row.userId,
		firstName: row.firstName,
		lastName: row.lastName,
		stats: buildCareerStatEntries(row),
	}
}

export function sortCareerStats(
	rows: CareerStatsRow[],
	sortBy: CareerStatField,
	sortDir: "asc" | "desc",
): CareerStatsRow[] {
	const sorted = [...rows].sort((a, b) => a[sortBy] - b[sortBy])
	return sortDir === "desc" ? sorted.reverse() : sorted
}

export function paginateCareerStats(
	rows: CareerStatsRow[],
	page: number,
	pageSize: number,
): CareerStatsRow[] {
	const start = (page - 1) * pageSize
	return rows.slice(start, start + pageSize)
}
