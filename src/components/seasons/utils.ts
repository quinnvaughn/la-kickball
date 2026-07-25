import { DateTime } from "luxon"
import type { DayOfWeek } from "#/server"
import type { SeasonWithStatus } from "#/server/domain/seasons"

export function toCapitalize(word: string) {
	return word[0].toUpperCase() + word.slice(1).toLowerCase()
}

export function formatDivision(division: SeasonWithStatus["division"]) {
	return division === "coed" ? "Coed" : "Men's"
}

export function formatDayOfTheWeek(dotw: DayOfWeek) {
	return toCapitalize(dotw)
}

export function formatHour(dt: DateTime) {
	return dt.minute === 0 ? dt.toFormat("h") : dt.toFormat("h:mm")
}

export function formatStartDate(startDate: string) {
	return DateTime.fromISO(startDate).toFormat("MMM d")
}

export function getSeasonProgressLabel(
	startDate: string,
	numWeeks: number,
	now = DateTime.now(),
) {
	const start = DateTime.fromISO(startDate).startOf("day")

	if (now < start) return `Starts ${formatStartDate(startDate)}`

	const regularSeasonEnd = start.plus({ weeks: numWeeks })
	if (now < regularSeasonEnd) {
		const week = Math.floor(now.diff(start, "weeks").weeks) + 1
		return `Week ${Math.min(week, numWeeks)} of ${numWeeks}`
	}

	const playoffsEnd = regularSeasonEnd.plus({ weeks: 2 })
	if (now < playoffsEnd) return "Playoffs"

	return "League Completed"
}

export function formatTimeRange(startTime: string, endTime: string) {
	const start = DateTime.fromFormat(startTime, "HH:mm:ss")
	const end = DateTime.fromFormat(endTime, "HH:mm:ss")

	const startMeridiem = start.toFormat("a").toLowerCase()
	const endMeridiem = end.toFormat("a").toLowerCase()

	const startLabel =
		formatHour(start) + (startMeridiem === endMeridiem ? "" : startMeridiem)
	const endLabel = formatHour(end) + endMeridiem

	return `${startLabel}-${endLabel}`
}
