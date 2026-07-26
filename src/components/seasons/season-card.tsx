import { Link } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import type { RouterOutputs } from "#/server/router"
import { Badge } from "../ui/badge"
import { sharedCardStyles } from "./styles"
import { formatTimeRange, toCapitalize } from "./utils"

type LeagueOutput = RouterOutputs["leagues"]["league"]
type Season = LeagueOutput["seasons"]["current"][number]

type Props = {
	season: Season
	league: string
}

function getSeasonStatus(
	startDate: string,
	numWeeks: number,
	now = DateTime.now(),
) {
	const newDate = DateTime.fromISO(startDate)
	const endOfRegularSeason = newDate.plus({ weeks: numWeeks })
	const endOfPlayoffs = newDate
		.plus({ weeks: numWeeks + 2 })
		.plus({ days: 1 })
		.startOf("day")

	if (now < newDate) return "Registration Open"
	if (now < endOfRegularSeason) return "In Progress"
	if (now < endOfPlayoffs) return "Playoffs"
	return "League Completed"
}

export function SeasonCard({ season, league }: Props) {
	return (
		<Link
			to="/leagues/$league/$season"
			params={{ league, season: season.slug }}
			className={sharedCardStyles}
		>
			<VStack gap="3" alignItems="start">
				<Badge
					text={
						season.startDate
							? getSeasonStatus(season.startDate, season.weeks)
							: "Registration Open"
					}
				/>
				<VStack gap="2" alignItems="start">
					<div
						className={css({
							fontFamily: "heading",
							fontWeight: "700",
							fontSize: "xl",
						})}
					>
						{season.name}
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
					<div className={css({ color: "subtitle", fontSize: "sm" })}>
						{season.playerMinimum}-player minimum · {season.weeks}-week season +
						playoffs
					</div>
				</VStack>
			</VStack>
		</Link>
	)
}
