import { DateTime } from "luxon"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import type { Schedule } from "#/server/domain/schedule"
import { SectionBlock } from "../ui/section-block"
import { WeekGroup } from "../week/week-group"
import { EmptyTabContainer } from "./empty-tab-container"

type Props = {
	schedule: Schedule
	seasonStart: string | null
	season: string
	league: { location: string; slug: string }
	captainTeamId: string | null
}

export function ScheduleTab({
	schedule,
	seasonStart,
	season,
	league,
	captainTeamId,
}: Props) {
	if (schedule.weeks.length === 0) {
		const seasonStartFormatted = seasonStart
			? DateTime.fromISO(seasonStart).toFormat("LLL dd")
			: "the season start date"

		return (
			<SectionBlock heading="Schedule">
				<EmptyTabContainer>
					<VStack gap="1">
						<p className={css({ color: "subtitle" })}>
							Schedule hasn't been posted yet. Check back closer to{" "}
							{seasonStartFormatted}.
						</p>
					</VStack>
				</EmptyTabContainer>
			</SectionBlock>
		)
	}

	return (
		<SectionBlock heading={"Schedule"} stretch>
			{schedule.weeks.map((w) => (
				<WeekGroup
					key={w.id}
					league={league}
					season={season}
					week={w}
					currentWeekId={schedule.currentWeekId}
					captainTeamId={captainTeamId}
				/>
			))}
		</SectionBlock>
	)
}
