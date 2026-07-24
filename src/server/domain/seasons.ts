import type { Season, Team } from "../db/schema"

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

export type SeasonStatus = "upcoming" | "current" | "past"

export function getSeasonStatus(
	season: Season,
	now = new Date(),
): SeasonStatus {
	if (season.startDate) {
		const start = new Date(season.startDate)
		const end = new Date(start)
		end.setDate(end.getDate() + season.weeks * 7 + 14)
		if (now > end) return "past"
	}

	const cmp = compareTuples(tupleForSeason(season, now), currentTuple(now))
	if (cmp > 0) return "upcoming"
	if (cmp < 0) return "past"
	return "current"
}

export const ROSTER_MINIMUM = 12

export type SeasonWinner = Pick<Team, "id" | "name">

type SeasonWithWinner = Season & { winner: SeasonWinner | null }

export type SeasonWithStatus = Omit<Season, "winnerId"> & {
	winner: SeasonWinner | null
	status: SeasonStatus
	playerMinimum: number
}

export interface BucketedSeasons {
	upcoming: SeasonWithStatus[]
	current: SeasonWithStatus[]
	past: SeasonWithStatus[]
}

export function bucketSeasonsByStatus(seasons: SeasonWithWinner[]) {
	const buckets: BucketedSeasons = { upcoming: [], current: [], past: [] }

	for (const season of seasons) {
		const { winnerId, ...rest } = season
		const withStatus = {
			...rest,
			status: getSeasonStatus(season),
			playerMinimum: ROSTER_MINIMUM,
		}
		buckets[withStatus.status].push(withStatus)
	}

	return buckets
}
