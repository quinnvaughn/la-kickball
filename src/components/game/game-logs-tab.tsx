import { Grid } from "styled-system/jsx"
import type { RouterOutputs } from "#/server"
import { SectionBlock } from "../ui/section-block"
import { HalfInningGroup } from "./half-inning-group"

export type HalfInning = RouterOutputs["games"]["byId"]["halfInnings"][number]

type Props = {
	halfInnings: HalfInning[]
	isGameInProgress: boolean
}

export function GameLogsTab({ halfInnings, isGameInProgress }: Props) {
	return (
		<SectionBlock
			heading="Game log"
			subtitle="Play by play, most recent first."
		>
			<Grid gap="2" width="full">
				{halfInnings.map((halfInning, i) => (
					<HalfInningGroup
						isOpen={isGameInProgress && i === 0}
						halfInning={halfInning}
						key={`${halfInning.half}-${halfInning.inning}`}
					/>
				))}
			</Grid>
		</SectionBlock>
	)
}
