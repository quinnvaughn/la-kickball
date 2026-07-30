import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { match } from "ts-pattern"
import type { CareerLeader } from "#/server/domain/stats"
import { LeagueLeaderCard } from "../leagues/league-leader-card"
import { SectionBlock } from "../ui/section-block"
import { EmptyTabContainer } from "./empty-tab-container"

type Props = {
	leaders: CareerLeader[]
	league: string
	season: string
}

export function SeasonStatsTab({ leaders, league, season }: Props) {
	return (
		<SectionBlock heading="Season leaders">
			{match(leaders)
				.when(
					(l) => l.length === 0,
					() => (
						<EmptyTabContainer>
							<p className={css({ color: "subtitle" })}>No stats yet.</p>
						</EmptyTabContainer>
					),
				)
				.otherwise((l) => (
					<>
						<div
							className={css({
								display: "grid",
								gridTemplateColumns: "repeat(4, 1fr)",
								gap: "3",
								width: "100%",
							})}
						>
							{l.map((leader) => (
								<LeagueLeaderCard leader={leader} key={leader.stat} />
							))}
						</div>
						<Link
							to="/leagues/$league/$season/stats"
							params={{ league, season }}
							className={css({
								color: "teal.dark",
								fontWeight: "700",
								_hover: { textDecoration: "underline" },
							})}
						>
							View full season stats →
						</Link>
					</>
				))}
		</SectionBlock>
	)
}
