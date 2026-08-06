import type { Week } from "../db/schema/weeks"

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

type RateCategory = "avg" | "slg" | "obp" | "ops"

const RATE_CATEGORIES: ReadonlySet<LeaderCategory> = new Set<RateCategory>([
	"avg",
	"slg",
	"obp",
	"ops",
])

export function isRateCategory(
	category: LeaderCategory,
): category is RateCategory {
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

// Stats that make sense shown as a rate "per game" to a captain sizing up
// a free agent/sub — the rate stats (avg/obp/slg/ops) are already a ratio
// over at-bats, dividing them again by games played would be meaningless.
export const PER_GAME_STAT_CATEGORIES = LEADER_CATEGORIES.filter(
	(category) => !isRateCategory(category),
)

export type PerGameStatCategory = (typeof PER_GAME_STAT_CATEGORIES)[number]

const STAT_LABELS = new Map(
	CAREER_STAT_FIELDS.map(({ key, label }) => [key, label]),
)

export interface PlayerTopStat {
	key: PerGameStatCategory
	label: string
	perGame: number
	// Raw count over the ranked scope (a week's games, or every game in a
	// season) — the MVP card shows this instead of perGame, since a season
	// MVP reads better as "28 Runs across 12 games" than an averaged rate.
	total: number
}

// Spelled-out singular/plural names for the stat categories that show up
// in topStats — the MVP card reads better as "3 Runs" than "3 R", but the
// career stats table still wants the compact CAREER_STAT_FIELDS
// abbreviation, so this is a separate map rather than a replacement.
const STAT_NAMES: Record<PerGameStatCategory, { singular: string; plural: string }> = {
	hits: { singular: "Hit", plural: "Hits" },
	singles: { singular: "Single", plural: "Singles" },
	doubles: { singular: "Double", plural: "Doubles" },
	triples: { singular: "Triple", plural: "Triples" },
	homers: { singular: "Home Run", plural: "Home Runs" },
	runs: { singular: "Run", plural: "Runs" },
	rki: { singular: "RKI", plural: "RKIs" },
	walks: { singular: "Walk", plural: "Walks" },
	sacs: { singular: "Sac", plural: "Sacs" },
	extraBasesTaken: { singular: "Extra Base Taken", plural: "Extra Bases Taken" },
}

// Formats a topStat's per-game rate as "<value> <name>" with the value
// trimmed to a whole number when it lands on one exactly (a season MVP's
// total is usually a clean multiple of games played) and one decimal
// otherwise, and the stat name singularized when that displayed value is 1.
export function formatStat(key: PerGameStatCategory, perGame: number): string {
	const display = Number.isInteger(perGame) ? perGame.toString() : perGame.toFixed(1)
	const names = STAT_NAMES[key]
	const name = Number(display) === 1 ? names.singular : names.plural
	return `${display} ${name}`
}

export interface PlayerAvailabilitySummary {
	userId: string
	firstName: string
	lastName: string
	gamesPlayed: number
	// null when the player has never logged a game — nothing to rank yet.
	topStat: PlayerTopStat | null
}

// Ranks a player's counting stats by per-game rate, highest first (ties
// keep whichever category comes first in `categories`) — someone who
// averages 2.1 RKI/game reads as an RKI guy, someone who mostly walks
// reads as a walks guy. This is a judgment call (favoring a player's own
// standout numbers over, say, how they compare to the rest of the
// league), not a derived "correct" answer. Empty for a player with no
// games played — nothing to rank yet.
export function buildTopStats(
	row: Pick<CareerStatsRow, PerGameStatCategory | "games">,
	count: number,
	categories: readonly PerGameStatCategory[] = PER_GAME_STAT_CATEGORIES,
): PlayerTopStat[] {
	if (row.games === 0) return []

	return [...categories]
		.sort((a, b) => row[b] - row[a])
		.slice(0, count)
		.map((key) => ({
			key,
			label: STAT_LABELS.get(key) ?? key,
			perGame: row[key] / row.games,
			total: row[key],
		}))
}

// A free-agent/weekly-sub card's player summary plus what's needed to
// send (or track) an invite for them. availabilityId is the
// freeAgentAvailability row this listing represents — that's what a
// freeAgentInvites row attaches to, not a raw userId. invited is only
// computed relative to the viewer's own captained team (there's no
// other team whose invites the viewer could see), so it's always false
// for a non-captain viewer.
export interface FreeAgentListing extends PlayerAvailabilitySummary {
	availabilityId: string
	invited: boolean
}

// The Weekly Subs tab's full payload — the players available to pick up,
// plus the week they're available for (null if the season has no
// Sunday-Saturday span matching today, e.g. off-season). Kept together
// since a listing without its week is ambiguous about what "available"
// means.
export interface WeeklySubs {
	week: Week | null
	players: FreeAgentListing[]
	// Both scoped to the viewer, and only meaningful for a signed-in one —
	// they gate the "mark yourself available" button, which is hidden
	// whenever either is true (already covered for the week, no need to
	// open up further) and always shown to a signed-out visitor (who by
	// definition has neither).
	viewerIsOnTeamForWeek: boolean
	viewerHasOpenAvailability: boolean
}

// Surfaces just the single standout stat, for the free-agent/weekly-sub
// cards — see buildTopStats for the ranking logic itself.
export function buildPlayerAvailabilitySummary(
	row: CareerStatsRow,
): PlayerAvailabilitySummary {
	const { userId, firstName, lastName, games } = row
	const [topStat] = buildTopStats(row, 1)

	return {
		userId,
		firstName,
		lastName,
		gamesPlayed: games,
		topStat: topStat ?? null,
	}
}

// hits is left out here — a week-MVP card already shows the hits/at-bats
// line (e.g. "4-5") directly, so surfacing "4 H" again as a top stat would
// just repeat it.
export const WEEK_MVP_STAT_CATEGORIES = PER_GAME_STAT_CATEGORIES.filter(
	(category) => category !== "hits",
)

export function sortCareerStats(
	rows: CareerStatsRow[],
	sortBy: CareerStatField,
	sortDir: "asc" | "desc",
): CareerStatsRow[] {
	const sorted = [...rows].sort((a, b) => a[sortBy] - b[sortBy])
	return sortDir === "desc" ? sorted.reverse() : sorted
}

type BoxScoreStatField = Exclude<CareerStatField, "seasons" | "games">

// A single game's box score line uses the same columns as the career
// stats table minus the two that only make sense aggregated across
// multiple games (seasons/games played).
export const BOX_SCORE_STAT_FIELDS = CAREER_STAT_FIELDS.filter(
	(field) => field.key !== "seasons" && field.key !== "games",
) as readonly { key: BoxScoreStatField; label: string }[]

export interface BoxScoreStatEntry {
	key: BoxScoreStatField
	label: string
	value: number
}

export interface BoxScorePlayer {
	userId: string
	firstName: string
	lastName: string
	stats: BoxScoreStatEntry[]
}

export function toBoxScorePlayer(totals: CareerTotals): BoxScorePlayer {
	const row = computeCareerStats(totals)

	return {
		userId: row.userId,
		firstName: row.firstName,
		lastName: row.lastName,
		stats: BOX_SCORE_STAT_FIELDS.map(({ key, label }) => ({
			key,
			label,
			value: row[key],
		})),
	}
}

export function paginateCareerStats(
	rows: CareerStatsRow[],
	page: number,
	pageSize: number,
): CareerStatsRow[] {
	const start = (page - 1) * pageSize
	return rows.slice(start, start + pageSize)
}
