import { Link } from "@tanstack/react-router"
import { css, cx } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import { match } from "ts-pattern"
import type { RouterOutputs } from "#/server"
import { Badge } from "../ui/badge"
import { formatHalfInning } from "./format-half-inning"

const teamColStyles = css({
	flex: 1,
	minWidth: "140px",
})

const teamNameStyles = css({
	fontFamily: "heading",
	fontWeight: "800",
	fontSize: "2xl",
})

type Game = RouterOutputs["games"]["byId"]

type Props = {
	league: string
	season: { slug: string }
	game: Game
}

export function MatchupRow({ league, season, game }: Props) {
	return (
		<div
			className={css({
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				flexWrap: "wrap",
				gap: "4",
			})}
		>
			<div className={teamColStyles}>
				<h2 className={teamNameStyles}>
					<Link
						to="/leagues/$league/$season/team/$teamId"
						params={{
							league,
							season: season.slug,
							teamId: game.awayTeamId,
						}}
						className={css({
							color: "ink",
							_hover: { textDecoration: "underline" },
						})}
					>
						{game.awayTeamName}
					</Link>
				</h2>
				{game.status === "completed" &&
					game.awayScore != null &&
					game.homeScore != null &&
					game.awayScore > game.homeScore && <Badge text="Winner" />}
			</div>
			<div className={css({ minWidth: "120px", textAlign: "center" })}>
				{match(game)
					.with({ status: "upcoming" }, () => (
						<VStack alignItems="center" gap="1">
							<div
								className={css({
									fontSize: "2xl",
									fontWeight: "700",
									color: "subtitle",
									fontFamily: "label",
								})}
							>
								vs.
							</div>
							<Badge color="gold" text="Upcoming" />
						</VStack>
					))
					.with({ status: "in_progress" }, () => (
						<VStack alignItems="center" gap="1">
							<div
								className={css({
									fontSize: "4xl",
									fontWeight: "700",
									color: "purple.dark",
									fontFamily: "label",
								})}
							>
								{game.awayScore} - {game.homeScore}
							</div>
							<Badge
								color="gold"
								text={
									formatHalfInning(game) ? `Live · ${formatHalfInning(game)}` : "Live"
								}
								dot
							/>
						</VStack>
					))
					.with({ status: "completed" }, () => (
						<VStack alignItems="center" gap="1">
							<div
								className={css({
									fontSize: "4xl",
									fontWeight: "700",
									color: "purple.dark",
									fontFamily: "label",
								})}
							>
								{game.awayScore} - {game.homeScore}
							</div>
							<Badge
								color="teal"
								text={game.awayScore === game.homeScore ? "Final · Tie" : "Final"}
							/>
						</VStack>
					))
					.with({ status: "suspended" }, () => (
						<VStack alignItems="center" gap="1">
							<div
								className={css({
									fontSize: "4xl",
									fontWeight: "700",
									color: "purple.dark",
									fontFamily: "label",
								})}
							>
								{game.awayScore} - {game.homeScore}
							</div>
							<Badge
								color="teal"
								text={
									formatHalfInning(game)
										? `Suspended · ${formatHalfInning(game)}`
										: "Suspended"
								}
							/>
						</VStack>
					))
					.otherwise(() => null)}
			</div>
			<div className={cx(teamColStyles, css({ textAlign: "right" }))}>
				<h2 className={teamNameStyles}>
					<Link
						to="/leagues/$league/$season/team/$teamId"
						params={{
							league,
							season: season.slug,
							teamId: game.homeTeamId,
						}}
						className={css({
							color: "ink",
							_hover: { textDecoration: "underline" },
						})}
					>
						{game.homeTeamName}
					</Link>
				</h2>
				{game.status === "completed" &&
					game.awayScore != null &&
					game.homeScore != null &&
					game.homeScore > game.awayScore && <Badge text="Winner" />}
			</div>
		</div>
	)
}
