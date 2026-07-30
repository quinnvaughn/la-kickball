import { DateTime } from "luxon"
import { css } from "styled-system/css"
import { Grid } from "styled-system/jsx"
import type { ScheduleWeek } from "#/server/domain/schedule"
import { Badge } from "../ui/badge"
import { WeekGameCard } from "./week-game-card"

type Props = {
	league: { location: string; slug: string }
	season: string
	week: ScheduleWeek
	currentWeekId: string | null
}

export function WeekGroup({ league, season, week, currentWeekId }: Props) {
	const isCurrentWeek = currentWeekId === week.id
	return (
		<details
			open={isCurrentWeek}
			className={css({
				borderRadius: "2xl",
				gap: "4",
				py: "4",
				px: "5",
				background: "#fff",
				borderColor: "border",
				borderWidth: "1px",
				borderStyle: "solid",
			})}
		>
			<summary
				className={css({
					fontFamily: "heading",
					fontWeight: "bold",
					fontSize: "lg",
					cursor: "pointer",
					color: "purple.dark",
				})}
			>
				<span
					className={css({
						display: "inline-flex",
						gap: "2",
						alignItems: "center",
					})}
				>
					<span>
						Week {week.weekNumber} ·{" "}
						{week.date
							? DateTime.fromISO(week.date).toFormat("LLL dd")
							: "Date TBD"}
					</span>
					{isCurrentWeek && <Badge color="gold" text="This week" />}
				</span>
			</summary>
			<Grid gap="3" className={css({ marginTop: "4" })}>
				{week.games.map((g) => (
					<WeekGameCard game={g} key={g.id} league={league} season={season} />
				))}
			</Grid>
		</details>
	)
}
