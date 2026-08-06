import { VStack } from "styled-system/jsx"
import type { RouterOutputs } from "#/server"
import { SectionBlock } from "../ui/section-block"
import { TeamBoxScore } from "./team-box-score"

type BoxScore = RouterOutputs["games"]["byId"]["homeBoxScore"]

type Props = {
	homeTeamName: string
	awayTeamName: string
	homeBoxScore: BoxScore
	awayBoxScore: BoxScore
}

export function BoxScoreTab({
	homeTeamName,
	awayTeamName,
	homeBoxScore,
	awayBoxScore,
}: Props) {
	return (
		<SectionBlock heading="Box score" subtitle="Stats for this game.">
			<VStack gap="8" alignItems="flex-start" width="100%">
				<TeamBoxScore teamName={awayTeamName} boxScore={awayBoxScore} />
				<TeamBoxScore teamName={homeTeamName} boxScore={homeBoxScore} />
			</VStack>
		</SectionBlock>
	)
}
