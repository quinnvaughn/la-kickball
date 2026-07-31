import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router"
import { DateTime } from "luxon"
import { css } from "styled-system/css"
import { Badge } from "#/components/ui/badge"
import { Breadcrumb } from "#/components/ui/breadcrumb"
import { PageContainer } from "#/components/ui/page-container"

export const Route = createFileRoute(
	"/_layout/leagues/$league/$season/game/$gameId/",
)({
	component: RouteComponent,
	loader: async ({ context: { trpc }, params: { gameId } }) => {
		return trpc.games.byId.query({ id: gameId })
	},
})

const teamColStyles = css({
	flex: 1,
	minWidth: "140px",
})

const teamNameStyles = css({
	fontFamily: "heading",
	fontWeight: "800",
	fontSize: "2xl",
})

function RouteComponent() {
	const season = useLoaderData({ from: "/_layout/leagues/$league/$season" })
	const { league } = Route.useParams()
	const game = Route.useLoaderData()
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
				</div>
			</div>
		</PageContainer>
	)
}
