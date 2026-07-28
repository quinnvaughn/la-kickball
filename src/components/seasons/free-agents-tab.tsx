import { css } from "styled-system/css"
import { Grid } from "styled-system/jsx"
import { match } from "ts-pattern"
import type { PlayerAvailabilitySummary } from "#/server/domain/stats"
import { SectionBlock } from "../ui/section-block"
import { EmptyTabContainer } from "./empty-tab-container"
import { FreeAgentRow } from "./free-agent-row"

type Props = {
	freeAgents: PlayerAvailabilitySummary[]
	captainTeamId: string | null
}

export function FreeAgentsTab({ freeAgents, captainTeamId }: Props) {
	return (
		<SectionBlock heading="Free agents">
			<Grid gap="3" width={"100%"}>
				{match(freeAgents)
					.when(
						(f) => f.length === 0,
						() => (
							<EmptyTabContainer>
								<p className={css({ color: "subtitle" })}>
									No free agents yet.
								</p>
							</EmptyTabContainer>
						),
					)
					.otherwise((freeAgents) =>
						freeAgents.map((fa) => (
							<FreeAgentRow
								player={fa}
								key={fa.userId}
								type="free-agent"
								captainTeamId={captainTeamId}
							/>
						)),
					)}
			</Grid>
		</SectionBlock>
	)
}
