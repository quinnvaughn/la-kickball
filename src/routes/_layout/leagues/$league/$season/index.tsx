import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { css } from "styled-system/css"
import { HStack, VStack } from "styled-system/jsx"
import { match } from "ts-pattern"
import { LeagueLocationLink } from "#/components/leagues/league-location-link"
import { RegisterTab } from "#/components/seasons/register-tab"
import { RegistrationPricing } from "#/components/seasons/registration-pricing"
import {
	formatDayOfTheWeek,
	formatTimeRange,
	getSeasonPhase,
	getSeasonProgressLabel,
	getSeasonTabs,
} from "#/components/seasons/utils"
import { Breadcrumb } from "#/components/ui/breadcrumb"
import { PageContainer } from "#/components/ui/page-container"
import { Tabs } from "#/components/ui/tabs"
import { ROSTER_MINIMUM } from "#/server/domain/seasons"

export const Route = createFileRoute("/_layout/leagues/$league/$season/")({
	component: RouteComponent,
	loader: async ({ context: { trpc }, params: { league, season } }) => {
		return trpc.leagues.season.query({ leagueSlug: league, seasonSlug: season })
	},
})

function RouteComponent() {
	const season = Route.useLoaderData()
	const phase = season.startDate
		? getSeasonPhase(season.startDate, season.weeks)
		: "upcoming"
	const tabs = getSeasonTabs(phase, season.isRegistered)
	const [activeTab, setActiveTab] = useState(tabs[0].key)

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
			<VStack gap="4" alignItems={"flex-start"}>
				<div
					className={css({
						pt: "4",
						pb: "8",
						borderBottomColor: "border",
						borderBottomStyle: "solid",
						borderBottomWidth: "1px",
						width: "100%",
					})}
				>
					<VStack alignItems="flex-start" gap="2">
						<HStack
							flexWrap={"wrap"}
							width={"100%"}
							gap="2"
							justifyContent={"space-between"}
						>
							<h1
								className={css({
									fontFamily: "heading",
									fontWeight: "800",
									fontSize: "4xl",
								})}
							>
								{season.name}
							</h1>
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
						</HStack>
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
				</div>
				<RegistrationPricing
					startDate={season.startDate}
					weeks={season.weeks}
				/>
				<Tabs>
					{tabs.map((tab) => (
						<Tabs.StateTab
							key={tab.key}
							active={activeTab === tab.key}
							onClick={() => setActiveTab(tab.key)}
						>
							{tab.label}
						</Tabs.StateTab>
					))}
				</Tabs>
				{match(activeTab)
					.with("register", () => (
						<RegisterTab
							playerMinimum={ROSTER_MINIMUM}
							league={season.league.name}
							season={season.name}
							handleGoToStandings={() => setActiveTab("standings")}
						/>
					))
					.otherwise(() => null)}
			</VStack>
		</PageContainer>
	)
}
