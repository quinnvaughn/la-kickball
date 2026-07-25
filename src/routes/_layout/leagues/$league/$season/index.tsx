import { createFileRoute } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import { LeagueLocationLink } from "#/components/leagues/league-location-link"
import {
	formatDayOfTheWeek,
	formatTimeRange,
	getSeasonProgressLabel,
} from "#/components/seasons/utils"
import { Breadcrumb } from "#/components/ui/breadcrumb"
import { PageContainer } from "#/components/ui/page-container"
import { SectionBlock } from "#/components/ui/section-block"
import { ROSTER_MINIMUM } from "#/server/domain/seasons"

export const Route = createFileRoute("/_layout/leagues/$league/$season/")({
	component: RouteComponent,
	loader: async ({ context: { trpc }, params: { league, season } }) => {
		return trpc.leagues.season.query({ leagueSlug: league, seasonSlug: season })
	},
})

function RouteComponent() {
	const season = Route.useLoaderData()
	return (
		<PageContainer>
			<Breadcrumb>
				<Breadcrumb.Item>
					<Breadcrumb.Link to="/">Leagues</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.Link
						to="/leagues/$league"
						params={{ league: season.league.slug }}
					>
						{season.league.name}
					</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.CurrentLink>{season.name}</Breadcrumb.CurrentLink>
				</Breadcrumb.Item>
			</Breadcrumb>
			<div
				className={css({
					pt: "4",
					pb: "8",
					borderBottomColor: "border",
					borderBottomStyle: "solid",
					borderBottomWidth: "1px",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					flexWrap: "wrap",
					gap: "4",
				})}
			>
				<VStack alignItems="flex-start" gap="2">
					<h1
						className={css({
							fontFamily: "heading",
							fontWeight: "800",
							fontSize: "4xl",
						})}
					>
						{season.name}
					</h1>
					<div className={css({ color: "subtitle" })}>
						<LeagueLocationLink
							name={season.league.locationName}
							url={season.league.locationUrl}
						/>
						{" · "}
						{formatDayOfTheWeek(season.dayOfWeek)}
						{" · "}
						{season.startTime && season.endTime
							? formatTimeRange(season.startTime, season.endTime)
							: "Time not yet set"}
						{" · "}
						{ROSTER_MINIMUM}-player roster minimum{" · "}
						{season.weeks}-week season + playoffs.
					</div>
				</VStack>
				<div
					className={css({
						fontFamily: "label",
						fontSize: "xs",
						textTransform: "uppercase",
						letterSpacing: "wider",
						color: "teal.dark",
						background: "rgba(0,169,157,0.12)",
						py: "2",
						px: "4",
						borderRadius: "full",
						whiteSpace: "nowrap",
						alignSelf: "flex-start",
					})}
				>
					{season.startDate
						? getSeasonProgressLabel(season.startDate, season.weeks)
						: "Start date TBD"}
				</div>
			</div>
			<SectionBlock heading="Registration Pricing">Registration</SectionBlock>
		</PageContainer>
	)
}
