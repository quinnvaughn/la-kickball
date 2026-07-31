import { DateTime } from "luxon"
import { css } from "styled-system/css"
import { Grid, VStack } from "styled-system/jsx"
import {
	type Bracket,
	bracketRoundsForTeamCount,
	type Schedule,
} from "#/server/domain/schedule"
import { SectionBlock } from "../ui/section-block"
import { WeekGameCard } from "../week/week-game-card"
import { EmptyTabContainer } from "./empty-tab-container"
import { ScheduleTab } from "./schedule-tab"

type Props = {
	bracket: Bracket
	schedule: Schedule
	seasonStart: string | null
	league: { location: string; slug: string }
	season: string
	captainTeamId: string | null
	teamCount: number
}

const ROUNDS = [
	{
		key: "quarterfinals",
		round: "quarterfinal",
		label: "Quarterfinals",
		shortLabel: "QF",
	},
	{
		key: "semifinals",
		round: "semifinal",
		label: "Semifinals",
		shortLabel: "SF",
	},
	{ key: "final", round: "final", label: "Final", shortLabel: "F" },
] as const

// The placeholder shown for a round whose games haven't been created yet.
// When the round right before it in the bracket is known (and isn't the
// final, which only ever has one game so there's nothing to enumerate),
// each of this round's slots is named after the pair of previous-round
// games that feed it (QF1 & QF2 -> SF1). Otherwise — this is the first
// round the bracket shows, so there's no previous round to point to — a
// single generic slot stands in for "not seeded yet."
function placeholderLabels(
	round: (typeof ROUNDS)[number],
	previousRound: (typeof ROUNDS)[number] | undefined,
): string[] {
	if (!previousRound) return ["Bracket hasn't been seeded yet"]

	if (round.key === "final") {
		return [`Winners of the ${previousRound.label.toLowerCase()} advance here`]
	}

	return [
		`Winners of ${previousRound.shortLabel}1 & ${previousRound.shortLabel}2 advance here`,
		`Winners of ${previousRound.shortLabel}3 & ${previousRound.shortLabel}4 advance here`,
	]
}

export function BracketTab({
	bracket,
	schedule,
	seasonStart,
	league,
	season,
	captainTeamId,
	teamCount,
}: Props) {
	const applicableRounds = bracketRoundsForTeamCount(teamCount)
	const rounds = ROUNDS.filter((round) =>
		applicableRounds.includes(round.round),
	)

	if (rounds.length === 0) {
		return (
			<SectionBlock heading="Bracket">
				<EmptyTabContainer>
					<p className={css({ color: "subtitle" })}>
						The playoff bracket hasn't been set yet.
					</p>
				</EmptyTabContainer>
			</SectionBlock>
		)
	}

	return (
		<>
			<SectionBlock heading="Bracket" stretch bottomBorder>
				{rounds.map((round, index) => {
					const { date, games } = bracket[round.key]

					return (
						<VStack key={round.key} gap="3" alignItems="flex-start">
							<div
								className={css({
									fontFamily: "label",
									fontSize: "xs",
									color: "subtitle",
									textTransform: "uppercase",
									letterSpacing: "wider",
								})}
							>
								{round.label}
								{date && (
									<span>
										{" · "}
										{DateTime.fromISO(date).toFormat("LLL dd")}
									</span>
								)}
							</div>
							<Grid
								gap="4"
								gridTemplateColumns={"repeat(2, 1fr)"}
								width={"100%"}
							>
								{games.length > 0
									? games.map((game) => (
											<WeekGameCard
												key={game.id}
												game={game}
												league={league}
												season={season}
												captainTeamId={captainTeamId}
											/>
										))
									: placeholderLabels(round, rounds[index - 1]).map((label) => (
											<div
												key={label}
												className={css({
													background: "#fff",
													borderWidth: "1px",
													borderStyle: "solid",
													borderColor: "border",
													borderRadius: "2xl",
													py: "5",
													px: "6",
													textAlign: "center",
													fontFamily: "label",
													fontSize: "sm",
													color: "subtitle",
												})}
											>
												{label}
											</div>
										))}
							</Grid>
						</VStack>
					)
				})}
			</SectionBlock>
			<ScheduleTab
				schedule={schedule}
				seasonStart={seasonStart}
				season={season}
				league={league}
				captainTeamId={captainTeamId}
			/>
		</>
	)
}
