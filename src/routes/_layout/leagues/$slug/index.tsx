import { createFileRoute } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { SeasonCard } from "#/components/seasons/season-card"
import { SeasonSection } from "#/components/seasons/season-section"
import { Breadcrumb } from "#/components/ui/breadcrumb"

export const Route = createFileRoute("/_layout/leagues/$slug/")({
	component: League,
	loader: async ({ params: { slug }, context: { trpc } }) => {
		return trpc.leagues.league.query({ slug })
	},
})

function League() {
	const { slug } = Route.useParams()
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
					borderBottom: "1px solid rgba(27, 42, 74, 0.1)",
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
						{seasons.current.map((c) => (
							<SeasonCard season={c} slug={slug} key={c.id} />
						))}
					</div>
				</SeasonSection>
			</div>
		</div>
	)
}
