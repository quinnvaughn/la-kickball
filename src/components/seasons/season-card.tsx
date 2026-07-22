import { Link } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { css, cx } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import type { RouterOutputs } from "#/server/router"

type LeagueOutput = RouterOutputs["leagues"]["league"]
type Season = LeagueOutput["seasons"]["current"][number]

type Props = {
	season: Season
	slug: string
}

const tagStyles = css({
	display: "inline-block",
	fontFamily: "label",
	fontSize: "xs",
	textTransform: "uppercase",
	letterSpacing: "wider",
	py: "1",
	px: "2",
	borderRadius: "full",
})

const divisionStyles = css({
	color: "teal.dark",
	backgroundColor: "rgba(0,169,157,0.12)",
})

const statusStyles = css({
	color: "gold.dark",
	background: "rgba(255,182,39,0.15)",
})

function getSeasonStatus(
	startDate: string,
	numWeeks: number,
	now = DateTime.now(),
) {
	const newDate = DateTime.fromISO(startDate)
	const endOfPlayoffs = newDate
		.plus({ weeks: numWeeks + 2 })
		.plus({ days: 1 })
		.startOf("day")

	if (now < newDate) return "Registration Open"
	if (now < endOfPlayoffs) return "In Progress"
	return "League Completed"
}

function toCapitalize(word: string) {
	return word[0].toUpperCase() + word.slice(1).toLowerCase()
}

function formatHour(dt: DateTime) {
	return dt.minute === 0 ? dt.toFormat("h") : dt.toFormat("h:mm")
}

function formatTimeRange(startTime: string, endTime: string) {
	const start = DateTime.fromFormat(startTime, "HH:mm:ss")
	const end = DateTime.fromFormat(endTime, "HH:mm:ss")

	const startMeridiem = start.toFormat("a").toLowerCase()
	const endMeridiem = end.toFormat("a").toLowerCase()

	const startLabel =
		formatHour(start) + (startMeridiem === endMeridiem ? "" : startMeridiem)
	const endLabel = formatHour(end) + endMeridiem

	return `${startLabel}-${endLabel}`
}

export function SeasonCard({ season, slug }: Props) {
	return (
		<Link
			to="/leagues/$slug/$season"
			params={{ slug, season: season.slug }}
			className={css({
				display: "block",
				background: "#fff",
				borderWidth: "1px",
				borderStyle: "solid",
				borderColor: "border",
				p: "6",
				textDecoration: "none",
				color: "ink",
				borderRadius: "2xl",
			})}
		>
			<VStack gap="3" alignItems="start">
				<div className={css({ display: "flex", gap: "1.5" })}>
					<span className={cx(tagStyles, divisionStyles)}>
						{season.division === "mens" ? "Men's" : "Co-ed"}
					</span>
					<span className={cx(tagStyles, statusStyles)}>
						{season.startDate
							? getSeasonStatus(season.startDate, season.weeks)
							: "Registration Open"}
					</span>
				</div>
				<VStack gap="2" alignItems="start">
					<div
						className={css({
							fontFamily: "heading",
							fontWeight: "700",
							fontSize: "xl",
						})}
					>
						{toCapitalize(season.season)} {season.year}
					</div>
					<div
						className={css({
							fontFamily: "label",
							fontSize: "sm",
							color: "purple.dark",
						})}
					>
						{`${toCapitalize(season.dayOfWeek)} · ${
							season.startTime && season.endTime
								? formatTimeRange(season.startTime, season.endTime)
								: season.startTime
						}`}
					</div>
				</VStack>
			</VStack>
		</Link>
	)
}
