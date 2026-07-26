import { DateTime } from "luxon"
import type { DayOfWeek } from "#/server"
import { PRICING } from "#/server/domain/pricing"
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

const PLAYOFF_WEEKS = 2

export function getPlayoffsEndDate(startDate: string, numWeeks: number) {
	const start = DateTime.fromISO(startDate).startOf("day")
	return start.plus({ weeks: numWeeks }).plus({ weeks: PLAYOFF_WEEKS })
}

export function hasPlayoffsEnded(
	startDate: string,
	numWeeks: number,
	now = DateTime.now(),
) {
	return now >= getPlayoffsEndDate(startDate, numWeeks)
}

export type SeasonPhase = "upcoming" | "regular" | "playoffs" | "completed"

export function getSeasonPhase(
	startDate: string,
	numWeeks: number,
	now = DateTime.now(),
): SeasonPhase {
	const start = DateTime.fromISO(startDate).startOf("day")

	if (now < start) return "upcoming"
	if (now < start.plus({ weeks: numWeeks })) return "regular"
	if (!hasPlayoffsEnded(startDate, numWeeks, now)) return "playoffs"

	return "completed"
}

export function getSeasonProgressLabel(
	startDate: string,
	numWeeks: number,
	now = DateTime.now(),
) {
	const phase = getSeasonPhase(startDate, numWeeks, now)

	switch (phase) {
		case "upcoming":
			return `Starts ${formatStartDate(startDate)}`
		case "regular": {
			const start = DateTime.fromISO(startDate).startOf("day")
			const week = Math.floor(now.diff(start, "weeks").weeks) + 1
			return `Week ${Math.min(week, numWeeks)} of ${numWeeks}`
		}
		case "playoffs":
			return "Playoffs"
		case "completed":
			return "League Completed"
	}
}

export type SeasonTabKey =
	| "register"
	| "free-agents"
	| "weekly-subs"
	| "schedule"
	| "bracket"
	| "standings"
	| "stats"

export type SeasonTab = {
	key: SeasonTabKey
	label: string
}

export function getSeasonTabs(
	phase: SeasonPhase,
	isRegistered: boolean,
): SeasonTab[] {
	const tabs: SeasonTab[] = []

	if (phase === "upcoming") {
		if (!isRegistered) {
			tabs.push({ key: "register", label: "Register" })
		}
		tabs.push({ key: "free-agents", label: "Free Agents" })
		tabs.push({ key: "schedule", label: "Schedule" })
		tabs.push({ key: "standings", label: "Standings" })
		tabs.push({ key: "stats", label: "Stats" })
		return tabs
	}

	if (phase === "playoffs" || phase === "completed") {
		tabs.push({ key: "bracket", label: "Bracket" })
	} else {
		tabs.push({ key: "schedule", label: "Schedule" })
	}

	tabs.push({ key: "standings", label: "Standings" })
	tabs.push({ key: "stats", label: "Stats" })

	if (phase === "regular" || phase === "playoffs") {
		tabs.push({ key: "weekly-subs", label: "Weekly Subs" })
	}

	return tabs
}

export type PricingTier = "early" | "normal" | "late"

export function getPricingTier(
	startDate: string,
	now = DateTime.now(),
): PricingTier {
	const start = DateTime.fromISO(startDate).startOf("day")
	const today = now.startOf("day")
	const earlyBirdCutoff = start.minus({
		days: PRICING.normalStartsDaysBeforeKickoff,
	})

	if (today < earlyBirdCutoff) return "early"
	if (today < start) return "normal"
	return "late"
}

function formatMonthDay(dt: DateTime) {
	return dt.toFormat("MMM d")
}

function formatDateRange(start: DateTime, end: DateTime) {
	return start.hasSame(end, "month")
		? `${formatMonthDay(start)}-${end.toFormat("d")}`
		: `${formatMonthDay(start)} - ${formatMonthDay(end)}`
}

export function getPricingTierDateLabels(startDate: string) {
	const start = DateTime.fromISO(startDate).startOf("day")
	const earlyBirdCutoff = start.minus({
		days: PRICING.normalStartsDaysBeforeKickoff,
	})

	return {
		early: `through ${formatMonthDay(earlyBirdCutoff.minus({ days: 1 }))}`,
		normal: formatDateRange(earlyBirdCutoff, start.minus({ days: 1 })),
		late: "Once the season starts",
	} satisfies Record<PricingTier, string>
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
