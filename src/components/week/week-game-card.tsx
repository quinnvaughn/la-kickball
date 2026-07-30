import { Link } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import type { ScheduleGame } from "#/server/domain/schedule"
import { Badge } from "../ui/badge"

type Props = {
	game: ScheduleGame
	league: { location: string; slug: string }
	season: string
	captainTeamId: string | null
}

const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" })
const ordinalSuffixes: Record<Intl.LDMLPluralRule, string> = {
	one: "st",
	two: "nd",
	few: "rd",
	other: "th",
	zero: "th",
	many: "th",
}

function formatInning(inning: number) {
	return `${inning}${ordinalSuffixes[ordinalRules.select(inning)]}`
}

function formatHalfInning(game: ScheduleGame) {
	if (game.half === null || game.inning === null) return null
	return `${game.half === 0 ? "Top" : "Bottom"} ${formatInning(game.inning)}`
}

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

	function isMiddleBold(game: ScheduleGame) {
		return game.status !== "completed"
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

	return (
		<div
			className={css({
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				flexWrap: "wrap",
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
			<VStack alignItems="flex-start" gap="1">
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
							formatHalfInning(game)
								? `Live · ${formatHalfInning(game)}`
								: "Live"
						}
						dot
					/>
				)}
				{game.status === "suspended" && (
					<Badge text={`Suspended · ${formatHalfInning(game)}`} />
				)}
				<div
					className={css({
						fontFamily: "heading",
						color: "purple.dark",
					})}
				>
					<span
						className={css({
							fontWeight: isAwayBold(game) ? "bold" : "normal",
						})}
					>
						{game.awayTeamName}
					</span>
					<span
						className={css({
							fontWeight: isMiddleBold(game) ? "bold" : "normal",
						})}
					>
						{" vs. "}
					</span>
					<span
						className={css({
							fontWeight: isHomeBold(game) ? "bold" : "normal",
						})}
					>
						{game.homeTeamName}
					</span>
				</div>
				<div className={css({ color: "subtitle", fontSize: "sm" })}>
					{league.location}, {game.field}
				</div>
			</VStack>
			{game.status === "in_progress" && (
				<Link
					to="/leagues/$league/$season/game/$gameId"
					params={{ league: league.slug, season, gameId: game.id }}
					className={css({
						fontFamily: "heading",
						fontWeight: "700",
						fontSize: "sm",
						color: "teal.dark",
						whiteSpace: "nowrap",
						flexShrink: 0,
						_hover: { textDecoration: "underline" },
					})}
				>
					Follow live →
				</Link>
			)}
			{myLineupIsUnset && (
				<Link
					to="/leagues/$league/$season/game/$gameId"
					params={{ league: league.slug, season, gameId: game.id }}
					className={css({
						fontFamily: "heading",
						fontWeight: "700",
						fontSize: "sm",
						background: "coral",
						color: "sand",
						py: "2",
						px: "4",
						borderRadius: "full",
						whiteSpace: "nowrap",
						_hover: { textDecoration: "underline" },
					})}
				>
					Set lineup →
				</Link>
			)}
			{(game.status === "completed" || game.status === "suspended") && (
				<Link
					to="/leagues/$league/$season/game/$gameId"
					params={{ league: league.slug, season, gameId: game.id }}
					className={css({
						fontFamily: "label",
						fontSize: "lg",
						background: "sand",
						py: "2",
						px: "3",
						borderRadius: "xl",
						color: "purple.dark",
						_hover: {
							textDecoration: "underline",
						},
					})}
				>
					<span
						className={css({
							fontWeight: isAwayBold(game) ? "bold" : "normal",
						})}
					>
						{game.awayScore}
					</span>
					{" - "}
					<span
						className={css({
							fontWeight: isHomeBold(game) ? "bold" : "normal",
						})}
					>
						{game.homeScore}
					</span>
				</Link>
			)}
		</div>
	)
}
