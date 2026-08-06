import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import type { RouterOutputs } from "#/server"
import type { BoxScoreStatEntry } from "#/server/domain/stats"
import { Table } from "../ui/table"

type BoxScore = RouterOutputs["games"]["byId"]["homeBoxScore"]
type SortKey = BoxScoreStatEntry["key"]

type Props = {
	teamName: string
	boxScore: BoxScore
}

const RATE_STATS = new Set(["avg", "obp", "slg", "ops"])

function formatStatValue({ key, value }: BoxScoreStatEntry) {
	return RATE_STATS.has(key) ? value.toFixed(3) : value
}

function sortValue(player: BoxScore[number], key: SortKey) {
	return player.stats.find((stat) => stat.key === key)?.value ?? 0
}

const teamHeadingStyles = css({
	fontFamily: "heading",
	fontWeight: "700",
	fontSize: "lg",
})

export function TeamBoxScore({ teamName, boxScore }: Props) {
	const [sortBy, setSortBy] = useState<SortKey>("atBats")
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

	function toggleSort(key: SortKey) {
		setSortDir(sortBy === key && sortDir === "asc" ? "desc" : "asc")
		setSortBy(key)
	}

	if (boxScore.length === 0) {
		return (
			<VStack gap="3" alignItems="flex-start" width="100%">
				<h3 className={teamHeadingStyles}>{teamName}</h3>
				<div className={css({ color: "subtitle", fontSize: "sm" })}>
					No stats logged for this team yet.
				</div>
			</VStack>
		)
	}

	const columns = [
		{ key: "player" as const, label: "Player", sortable: false },
		...boxScore[0].stats.map(({ key, label }) => ({
			key,
			label,
			sortable: true,
			numeric: true,
		})),
	]

	const sorted = [...boxScore].sort((a, b) => {
		const aVal = sortValue(a, sortBy)
		const bVal = sortValue(b, sortBy)
		const diff = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
		return sortDir === "desc" ? -diff : diff
	})

	return (
		<VStack gap="3" alignItems="flex-start" width="100%">
			<h3 className={teamHeadingStyles}>{teamName}</h3>
			<Table sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
				<Table.Head columns={columns} />
				<Table.Body>
					{sorted.map((player) => (
						<Table.Row key={player.userId}>
							<Table.Cell>
								<Link
									to="/user/$userId"
									params={{ userId: player.userId }}
									className={css({
										color: "purple.dark",
										fontWeight: "800",
										fontFamily: "heading",
										_hover: { textDecoration: "underline" },
									})}
								>
									{player.firstName} {player.lastName}
								</Link>
							</Table.Cell>
							{player.stats.map((stat) => (
								<Table.Cell key={stat.key} numeric>
									{formatStatValue(stat)}
								</Table.Cell>
							))}
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</VStack>
	)
}
