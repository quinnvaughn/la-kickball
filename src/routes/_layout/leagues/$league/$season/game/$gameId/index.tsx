import { createFileRoute, useLoaderData } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { useState } from "react"
import { css } from "styled-system/css"
import { Grid, HStack, VStack } from "styled-system/jsx"
import { BoxScoreTab } from "#/components/game/box-score-tab"
import { GameLogsTab } from "#/components/game/game-logs-tab"
import { LineupCard } from "#/components/game/lineup-card"
import { MatchupRow } from "#/components/game/matchup-row"
import { Breadcrumb } from "#/components/ui/breadcrumb"
import { PageContainer } from "#/components/ui/page-container"
import { SectionBlock } from "#/components/ui/section-block"
import { Tabs } from "#/components/ui/tabs"
import { formatUsersName } from "#/components/user/utils"

export const Route = createFileRoute(
	"/_layout/leagues/$league/$season/game/$gameId/",
)({
	component: RouteComponent,
	loader: async ({ context: { trpc }, params: { gameId } }) => {
		return trpc.games.byId.query({ id: gameId })
	},
})

function RouteComponent() {
	const user = useLoaderData({ from: "/_layout" })
	const season = useLoaderData({ from: "/_layout/leagues/$league/$season" })
	const { league } = Route.useParams()
	const game = Route.useLoaderData()
	const [tabs, setTabs] = useState<"box-score" | "game-log">("box-score")

	return (
		<PageContainer>
			<Breadcrumb>
				<Breadcrumb.Item>
					<Breadcrumb.Link to="/">Leagues</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.Link to="/leagues/$league" params={{ league }}>
						{season.league.name}
					</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.Link
						to="/leagues/$league/$season"
						params={{ league, season: season.slug }}
					>
						{season.name}
					</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.CurrentLink>
						{game.awayTeamName} vs {game.homeTeamName}
						{game.week ? ` · Week ${game.week.weekNumber}` : ""}
					</Breadcrumb.CurrentLink>
				</Breadcrumb.Item>
			</Breadcrumb>
			<div
				className={css({
					py: "6",
					borderBottomColor: "border",
					borderBottomWidth: "1px",
					borderBottomStyle: "solid",
					display: "flex",
					flexDir: "column",
					gap: "4",
				})}
			>
				{game.startTime && (
					<div
						className={css({
							fontFamily: "label",
							fontSize: "xs",
							color: "teal.dark",
						})}
					>
						{DateTime.fromISO(game.startTime).toFormat("ccc, LLL c")} ·{" "}
						{DateTime.fromISO(game.startTime).toFormat("t")} ·{" "}
						{season.league.locationName}, {game.field} · Week{" "}
						{game.week?.weekNumber}
					</div>
				)}
				<MatchupRow league={league} season={season} game={game} />
			</div>
			<div
				className={css({
					py: "8",
					borderBottomColor: "border",
					borderBottomWidth: "1px",
					borderBottomStyle: "solid",
				})}
			>
				<div
					className={css({
						background: "#fff",
						borderColor: "border",
						borderWidth: "1px",
						borderStyle: "solid",
						borderRadius: "2xl",
						py: "5",
						px: "6",
						width: "100%",
					})}
				>
					<HStack gap="4" justify={"space-between"} flexWrap="wrap">
						<VStack gap="1" alignItems="flex-start">
							<div
								className={css({ fontFamily: "heading", fontWeight: "700" })}
							>
								Ref
							</div>
							<div className={css({ fontSize: "sm", color: "subtitle" })}>
								{game.ref ? formatUsersName(game.ref) : "Not yet assigned"}
							</div>
						</VStack>
					</HStack>
				</div>
			</div>
			<SectionBlock
				heading="Lineups"
				subtitle="What each captain has submitted for today."
				bottomBorder
			>
				<Grid
					width="100%"
					gap="4"
					gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
				>
					<LineupCard
						teamName={game.awayTeamName}
						lineup={game.awayLineup}
						lineupSet={game.awayLineupSet}
					/>
					<LineupCard
						teamName={game.homeTeamName}
						lineup={game.homeLineup}
						lineupSet={game.homeLineupSet}
					/>
				</Grid>
			</SectionBlock>
			<Tabs>
				<Tabs.StateTab
					active={tabs === "box-score"}
					onClick={() => setTabs("box-score")}
				>
					Box score
				</Tabs.StateTab>
				<Tabs.StateTab
					active={tabs === "game-log"}
					onClick={() => setTabs("game-log")}
				>
					Game log
				</Tabs.StateTab>
			</Tabs>
			{tabs === "box-score" && (
				<BoxScoreTab
					homeTeamName={game.homeTeamName}
					awayTeamName={game.awayTeamName}
					homeBoxScore={game.homeBoxScore}
					awayBoxScore={game.awayBoxScore}
				/>
			)}
			{tabs === "game-log" && (
				<GameLogsTab
					halfInnings={game.halfInnings}
					isGameInProgress={game.status === "in_progress"}
				/>
			)}
		</PageContainer>
	)
}
