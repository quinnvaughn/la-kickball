import { createFileRoute } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { match } from "ts-pattern"
import { EmptySeasonCard } from "#/components/seasons/empty-season-card"
import { SeasonCard } from "#/components/seasons/season-card"
import { SeasonRow } from "#/components/seasons/season-row"
import { SeasonSection } from "#/components/seasons/season-section"
import { Breadcrumb } from "#/components/ui/breadcrumb"

export const Route = createFileRoute("/_layout/leagues/$league/")({
	component: League,
	loader: async ({ params: { league }, context: { trpc } }) => {
		return trpc.leagues.league.query({ slug: league })
	},
})

function League() {
	const { league } = Route.useParams()
	const { name, locationUrl, locationName, seasons } = Route.useLoaderData()

	return (
		<div className={css({ maxW: "5xl", mx: "auto", px: "8" })}>
			<Breadcrumb>
				<Breadcrumb.Item>
					<Breadcrumb.Link to="/">Leagues</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.CurrentLink>{name}</Breadcrumb.CurrentLink>
				</Breadcrumb.Item>
			</Breadcrumb>
			<div
				className={css({
					pt: "4",
					pb: "8",
				})}
			>
				<h1
					className={css({
						fontFamily: "heading",
						fontWeight: "800",
						fontSize: "4xl",
					})}
				>
					{name}
				</h1>
				<a
					href={locationUrl}
					className={css({ color: "teal.dark", textDecoration: "underline" })}
				>
					{locationName}
				</a>
				<SeasonSection heading="Current seasons">
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
							gap: "3",
							width: "100%",
						})}
					>
						{match(seasons.current)
							.when(
								(v) => v.length === 0,
								() => (
									<EmptySeasonCard message="No current seasons. Check back later." />
								),
							)
							.otherwise((v) =>
								v.map((c) => (
									<SeasonCard season={c} league={league} key={c.id} />
								)),
							)}
					</div>
				</SeasonSection>
				<SeasonSection heading="Past seasons">
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
							gap: "3",
							width: "100%",
						})}
					>
						{match(seasons.past)
							.when(
								(v) => v.length === 0,
								() => <EmptySeasonCard message="No past seasons yet." />,
							)
							.otherwise((v) =>
								v.map((c) => (
									<SeasonRow season={c} league={league} key={c.id} />
								)),
							)}
					</div>
				</SeasonSection>
				<SeasonSection heading="Upcoming seasons">
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
							gap: "3",
							width: "100%",
						})}
					>
						{match(seasons.upcoming)
							.when(
								(v) => v.length === 0,
								() => (
									<EmptySeasonCard message="No upcoming seasons. Check back later." />
								),
							)
							.otherwise((v) =>
								v.map((c) => (
									<SeasonCard season={c} league={league} key={c.id} />
								)),
							)}
					</div>
				</SeasonSection>
			</div>
		</div>
	)
}
