import { Link } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { useState } from "react"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import { match } from "ts-pattern"
import type { ScheduleGame } from "#/server/domain/schedule"
import { Badge } from "../ui/badge"

type Props = {
	game: ScheduleGame
	league: { location: string; slug: string }
	season: string
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

export function WeekGameCard({ game, league, season }: Props) {
	const [isHovering, setIsHovering] = useState(false)
	return (
		<Link
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			to="/leagues/$league/$season/game/$gameId"
			params={{ league: league.slug, season, gameId: game.id }}
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
						fontWeight: "bold",
						color: "purple.dark",
						textDecoration: isHovering ? "underline" : "none",
					})}
				>
					{game.awayTeamName} vs. {game.homeTeamName}
				</div>
				<div className={css({ color: "subtitle", fontSize: "sm" })}>
					{league.location}, {game.field}
				</div>
			</VStack>
			{game.status === "in_progress" && (
				<div
					className={css({
						fontFamily: "heading",
						fontWeight: "700",
						fontSize: "sm",
						color: "teal.dark",
						whiteSpace: "nowrap",
						flexShrink: 0,
						textDecoration: isHovering ? "underline" : "none",
					})}
				>
					Follow live →
				</div>
			)}
			{(game.status === "completed" || game.status === "suspended") && (
				<div
					className={css({
						fontFamily: "label",
						fontWeight: "700",
						fontSize: "lg",
						background: "sand",
						py: "2",
						px: "3",
						borderRadius: "xl",
						color: "purple.dark",
					})}
				>
					{game.awayScore} - {game.homeScore}
				</div>
			)}
		</Link>
	)
}
