import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import type { SeasonMvp } from "#/server/domain/schedule"
import { formatStat } from "#/server/domain/stats"
import { formatUsersName } from "../user/utils"

type Props = {
	seasonLabel: string
	championName: string
	championTeamId: string
	league: string
	season: string
	opponentName: string
	championScore: number
	opponentScore: number
	playoffMvp: SeasonMvp | null
}

const eyebrowStyles = css({
	fontFamily: "label",
	fontSize: "xs",
	textTransform: "uppercase",
	letterSpacing: "wider",
	color: "gold",
})

export function ChampionBanner({
	seasonLabel,
	championName,
	opponentName,
	championScore,
	opponentScore,
	playoffMvp,
	championTeamId,
	league,
	season,
}: Props) {
	return (
		<div
			className={css({
				background: "ink",
				borderRadius: "2xl",
				py: "8",
				px: "6",
				width: "100%",
			})}
		>
			<VStack gap="2">
				<div className={eyebrowStyles}>{seasonLabel} Champion</div>
				<h2>
					<Link
						to="/leagues/$league/$season/team/$teamId"
						params={{ league, season, teamId: championTeamId }}
						className={css({
							fontFamily: "heading",
							fontWeight: "800",
							fontSize: "3xl",
							color: "sand",
							borderBottomColor: "gold",
							borderBottomWidth: "2px",
							borderBottomStyle: "solid",
						})}
					>
						{championName}
					</Link>
				</h2>
				<div className={css({ color: "rgba(255,255,255,0.8)" })}>
					Beat {opponentName} {championScore}-{opponentScore} in the final.
					Season complete.
				</div>
			</VStack>
			{playoffMvp && (
				<VStack
					gap="2"
					mt="6"
					pt="6"
					borderTopWidth="1px"
					borderTopStyle="solid"
					borderTopColor="rgba(255,255,255,0.15)"
				>
					<div className={eyebrowStyles}>Playoff MVP</div>
					<Link
						to="/user/$userId"
						params={{ userId: playoffMvp.userId }}
						className={css({
							fontFamily: "heading",
							fontWeight: "700",
							fontSize: "lg",
							color: "sand",
							borderBottomColor: "gold",
							borderBottomWidth: "1px",
							borderBottomStyle: "solid",
						})}
					>
						{formatUsersName(playoffMvp)}
					</Link>
					<div
						className={css({ color: "rgba(255,255,255,0.75)", fontSize: "sm" })}
					>
						{playoffMvp.teamName}
						{" · "}
						{playoffMvp.topStats.map(
							(ts, i) =>
								`${formatStat(ts.key, ts.total)}${i < playoffMvp.topStats.length - 1 ? " · " : ""}`,
						)}
						{` across ${playoffMvp.games} playoff ${playoffMvp.games === 1 ? "game" : "games"}`}
					</div>
				</VStack>
			)}
		</div>
	)
}
