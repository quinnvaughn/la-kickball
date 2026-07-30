import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import { match } from "ts-pattern"
import type { TeamStanding } from "#/server/domain/standings"
import { SectionBlock } from "../ui/section-block"
import { Table } from "../ui/table"
import { EmptyTabContainer } from "./empty-tab-container"

type Props = {
	standings: TeamStanding[]
	league: string
	season: string
	isRegistered: boolean
}

type SortKey =
	| "wins"
	| "losses"
	| "ties"
	| "points"
	| "runsFor"
	| "runsAgainst"
	| "runDiff"

const columns: {
	key: "team" | SortKey
	label: string
	sortable?: boolean
	numeric?: boolean
}[] = [
	{ key: "team", label: "Team", sortable: false },
	{ key: "wins", label: "W", numeric: true },
	{ key: "losses", label: "L", numeric: true },
	{ key: "ties", label: "T", numeric: true },
	{ key: "points", label: "PTS", numeric: true },
	{ key: "runsFor", label: "RF", numeric: true },
	{ key: "runsAgainst", label: "RA", numeric: true },
	{ key: "runDiff", label: "+/-", numeric: true },
]

export function StandingsTab({
	standings,
	league,
	season,
	isRegistered,
}: Props) {
	// Points is what standings actually rank on (3/1/0 for win/tie/loss),
	// with run differential as the tiebreak — same order computeStandings
	// returns them in, so this is just the default sort, not a different one.
	const [sortBy, setSortBy] = useState<SortKey>("points")
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

	function toggleSort(key: SortKey) {
		setSortDir(sortBy === key && sortDir === "desc" ? "asc" : "desc")
		setSortBy(key)
	}

	const sorted = [...standings].sort((a, b) => {
		const diff = a[sortBy] - b[sortBy]
		return sortDir === "desc" ? -diff : diff
	})

	return (
		<SectionBlock heading="Standings">
			{match(standings)
				.when(
					(s) => s.length === 0,
					() => (
						<EmptyTabContainer>
							<VStack gap="1">
								<p className={css({ color: "subtitle" })}>
									No teams registered yet.
								</p>
								{!isRegistered && (
									<Link
										to="/leagues/$league/$season/create-team"
										params={{ league, season }}
										className={css({
											background: "transparent",
											color: "purple.dark",
											borderColor: "purple",
											borderWidth: "2px",
											borderStyle: "solid",
											borderRadius: "full",
											fontFamily: "heading",
											fontWeight: "700",
											py: "3",
											px: "6",
											cursor: "pointer",
										})}
									>
										Register the first team
									</Link>
								)}
								{isRegistered && (
									<p className={css({ color: "subtitle" })}>
										Check back once teams start registering.
									</p>
								)}
							</VStack>
						</EmptyTabContainer>
					),
				)
				.otherwise(() => (
					<Table sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
						<Table.Head columns={columns} />
						<Table.Body>
							{sorted.map((team) => (
								<Table.Row key={team.teamId}>
									<Table.Cell>
										<Link
											to="/leagues/$league/$season/team/$teamId"
											params={{ league, season, teamId: team.teamId }}
											className={css({
												fontWeight: "bold",
												fontFamily: "heading",
												color: "purple.dark",
												_hover: { textDecoration: "underline" },
											})}
										>
											{team.teamName}
										</Link>
									</Table.Cell>
									<Table.Cell numeric>{team.wins}</Table.Cell>
									<Table.Cell numeric>{team.losses}</Table.Cell>
									<Table.Cell numeric>{team.ties}</Table.Cell>
									<Table.Cell numeric>{team.points}</Table.Cell>
									<Table.Cell numeric>{team.runsFor}</Table.Cell>
									<Table.Cell numeric>{team.runsAgainst}</Table.Cell>
									<Table.Cell numeric>
										{team.runDiff > 0 ? `+${team.runDiff}` : team.runDiff}
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				))}
		</SectionBlock>
	)
}
