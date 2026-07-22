import type { Season, seasons } from "../db/schema"

const SEASON_ORDER = ["winter", "spring", "summer", "fall"] as const

export function generateSeasonSlug(
	season: Pick<Season, "season" | "year" | "division">,
): string {
	return `${season.season}-${season.year}-${season.division}`
}

function seasonRankForMonth(month: number): number {
	return Math.floor(month / 3)
}

interface SeasonTuple {
	year: number
	rank: number
}

function compareTuples(a: SeasonTuple, b: SeasonTuple): number {
	return a.year !== b.year ? a.year - b.year : a.rank - b.rank
}

function currentTuple(now: Date): SeasonTuple {
	return { year: now.getFullYear(), rank: seasonRankForMonth(now.getMonth()) }
}

function tupleForSeason(season: Season, now: Date): SeasonTuple {
	const rank = SEASON_ORDER.indexOf(season.season)

	if (season.startDate) {
		return { year: new Date(season.startDate).getFullYear(), rank }
	}

	// No startDate yet: assume the next occurrence of this season on or after now.
	const current = currentTuple(now)
	const year = rank < current.rank ? current.year + 1 : current.year
	return { year, rank }
}

export type SeasonStatus = "future" | "current" | "past"

export function getSeasonStatus(season: Season, now = new Date()): SeasonStatus {
	if (season.startDate) {
		const start = new Date(season.startDate)
		const end = new Date(start)
		end.setDate(end.getDate() + season.weeks * 7 + 14)
		if (now > end) return "past"
	}

	const cmp = compareTuples(tupleForSeason(season, now), currentTuple(now))
	if (cmp > 0) return "future"
	if (cmp < 0) return "past"
	return "current"
}

export const ROSTER_MINIMUM: Record<
	(typeof seasons.$inferSelect)["division"],
	number
> = {
	coed: 12,
	mens: 10,
}

export type SeasonWithStatus = Season & { status: SeasonStatus }

export interface BucketedSeasons {
	future: SeasonWithStatus[]
	current: SeasonWithStatus[]
	past: SeasonWithStatus[]
}

export function bucketSeasonsByStatus(seasons: Season[]): BucketedSeasons {
	const buckets: BucketedSeasons = { future: [], current: [], past: [] }

	for (const season of seasons) {
		const withStatus = { ...season, status: getSeasonStatus(season) }
		buckets[withStatus.status].push(withStatus)
	}

	return buckets
}
