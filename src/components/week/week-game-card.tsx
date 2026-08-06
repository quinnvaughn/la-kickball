import { Link } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { css, cx } from "styled-system/css"
import { match, P } from "ts-pattern"
import type { ScheduleGame } from "#/server/domain/schedule"
import { formatHalfInning } from "../game/format-half-inning"
import { Badge } from "../ui/badge"

type Props = {
	game: ScheduleGame
	league: { location: string; slug: string }
	season: string
	captainTeamId: string | null
}

const gameRowStyles = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
})

const winnerStyles = css({
	fontWeight: "bold",
})

const loserStyles = css({
	opacity: 0.5,
})

const scoreStyles = css({ fontSize: "lg", fontFamily: "label" })

const teamNameStyles = css({
	fontFamily: "heading",
	_hover: { textDecoration: "underline" },
})

export function WeekGameCard({ game, league, season, captainTeamId }: Props) {
	// Only upcoming games take a lineup submission — once a game has
	// started/ended, whatever lineup exists (or doesn't) is locked in.
	const myLineupIsUnset =
		game.status === "upcoming" &&
		((captainTeamId === game.homeTeamId && !game.homeLineupSet) ||
			(captainTeamId === game.awayTeamId && !game.awayLineupSet))

	function isAwayBold(game: ScheduleGame) {
		return (
			game.status !== "completed" ||
			(game.status === "completed" &&
				game.awayScore &&
				game.homeScore &&
				game.awayScore > game.homeScore)
		)
	}

	function isHomeBold(game: ScheduleGame) {
		return (
			game.status !== "completed" ||
			(game.status === "completed" &&
				game.awayScore &&
				game.homeScore &&
				game.homeScore > game.awayScore)
		)
	}

	function getLinkText(game: ScheduleGame, lineupIsUnset: boolean) {
		return match([game.status, lineupIsUnset] as const)
			.with(["in_progress", P.any], () => "Follow live")
			.with([P.any, true], () => "Set lineup")
			.with(["completed", P.any], () => "View box score")
			.otherwise(() => "View game")
	}

	return (
		<div
			className={css({
				display: "flex",
				flexDirection: "column",
				borderRadius: "2xl",
				gap: "2",
				py: "4",
				px: "5",
				background: "#fff",
				borderColor: "border",
				borderWidth: "1px",
				borderStyle: "solid",
			})}
		>
			{game.status === "upcoming" && game.startTime && (
				<div
					className={css({
						fontFamily: "label",
						fontSize: "xs",
						color: "teal.dark",
					})}
				>
					{DateTime.fromISO(game.startTime).toFormat("ccc, LLL d · t")}
				</div>
			)}
			{game.status === "in_progress" && (
				<Badge
					color="gold"
					text={
						formatHalfInning(game) ? `Live · ${formatHalfInning(game)}` : "Live"
					}
					className={css({ alignSelf: "flex-start" })}
					dot
				/>
			)}
			{game.status === "suspended" && (
				<Badge
					text={`Suspended · ${formatHalfInning(game)}`}
					className={css({ alignSelf: "flex-start" })}
				/>
			)}
			{myLineupIsUnset && (
				<Badge
					color="gold"
					text="Lineup not yet set"
					className={css({ alignSelf: "flex-start" })}
				/>
			)}
			<div
				className={cx(
					gameRowStyles,
					isAwayBold(game) ? winnerStyles : loserStyles,
				)}
			>
				<Link
					to="/leagues/$league/$season/team/$teamId"
					params={{ league: league.slug, season, teamId: game.awayTeamId }}
					className={teamNameStyles}
				>
					{game.awayTeamName}
				</Link>
				<span className={scoreStyles}>{game.awayScore}</span>
			</div>
			<div
				className={cx(
					gameRowStyles,
					isHomeBold(game) ? winnerStyles : loserStyles,
				)}
			>
				<Link
					to="/leagues/$league/$season/team/$teamId"
					params={{ league: league.slug, season, teamId: game.homeTeamId }}
					className={teamNameStyles}
				>
					{game.homeTeamName}
				</Link>
				<span className={scoreStyles}>{game.homeScore}</span>
			</div>
			<div className={css({ color: "subtitle", fontSize: "sm" })}>
				{league.location}, {game.field}
			</div>
			<Link
				to="/leagues/$league/$season/game/$gameId"
				params={{ league: league.slug, season, gameId: game.id }}
				className={css({
					display: "inline-flex",
					alignItems: "center",
					gap: "1",
					fontFamily: "label",
					fontWeight: "700",
					fontSize: "sm",
					color: "teal.dark",
					whiteSpace: "nowrap",
					flexShrink: 0,
					_hover: { textDecoration: "underline" },
				})}
			>
				{getLinkText(game, myLineupIsUnset)}
				{" →"}
			</Link>
		</div>
	)
}
