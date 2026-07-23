import type { SeasonWithStatus } from "#/server/domain/seasons"

export function toCapitalize(word: string) {
	return word[0].toUpperCase() + word.slice(1).toLowerCase()
}

export function formatSeasonName(season: SeasonWithStatus) {
	return `${toCapitalize(season.season)} ${season.year}`
}

export function formatDivision(division: SeasonWithStatus["division"]) {
	return division === "coed" ? "Coed" : "Men's"
}
