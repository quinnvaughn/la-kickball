import { Link } from "@tanstack/react-router"
import { css, cx } from "styled-system/css"
import { HStack, VStack } from "styled-system/jsx"
import type { RouterOutputs } from "#/server"
import { Badge } from "../ui/badge"
import { formatUsersName } from "../user/utils"

type Lineup = RouterOutputs["games"]["byId"]["homeLineup"]

type Props = {
	teamName: string
	lineup: Lineup
	lineupSet: boolean
}

const teamColStyles = css({
	flex: 1,
	minWidth: "140px",
})

export function LineupCard({ teamName, lineup, lineupSet }: Props) {
	return (
		<div
			className={cx(
				teamColStyles,
				css({
					background: "#fff",
					borderColor: "border",
					borderWidth: "1px",
					borderStyle: "solid",
					borderRadius: "2xl",
					py: "5",
					px: "6",
				}),
			)}
		>
			<VStack gap="3" alignItems="flex-start">
				<HStack
					gap="2"
					alignItems="center"
					justify="space-between"
					width="100%"
				>
					<span className={css({ fontFamily: "heading", fontWeight: "700" })}>
						{teamName} Lineup
					</span>
					<Badge
						color={lineupSet ? "teal" : "gold"}
						text={lineupSet ? "Lineup set" : "Not yet set"}
						bold={false}
					/>
				</HStack>
				{lineupSet ? (
					<VStack
						gap="1"
						alignItems="flex-start"
						className={css({ width: "100%" })}
					>
						{lineup.map((entry) => (
							<HStack
								key={entry.player.id}
								gap="2"
								justify="space-between"
								className={css({ width: "100%" })}
							>
								<span className={css({ color: "subtitle" })}>
									{entry.battingOrder}.
								</span>
								<Link
									to="/user/$userId"
									params={{ userId: entry.player.id }}
									className={css({
										flex: 1,
										_hover: { textDecoration: "underline" },
									})}
								>
									{formatUsersName(entry.player)}
								</Link>
							</HStack>
						))}
					</VStack>
				) : (
					<div
						className={css({
							color: "subtitle",
							fontStyle: "italic",
							fontSize: "sm",
						})}
					>
						Their captain hasn't submitted a lineup.
					</div>
				)}
			</VStack>
		</div>
	)
}
