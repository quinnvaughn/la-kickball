import { createFileRoute, Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import z from "zod"
import { Breadcrumb } from "#/components/ui/breadcrumb"
import { Table } from "#/components/ui/table"
import {
	CAREER_STAT_FIELD_KEYS,
	CAREER_STAT_FIELDS,
	type CareerStatField,
} from "#/server/domain/stats"

const RATE_FIELDS = new Set<CareerStatField>(["avg", "obp", "slg", "ops"])

const PAGE_SIZE = 10

type SortKey = "player" | CareerStatField

const columns: {
	key: SortKey
	label: string
	sortable?: boolean
	numeric?: boolean
}[] = [
	{ key: "player", label: "Player", sortable: false },
	...CAREER_STAT_FIELDS.map((field) => ({ ...field, numeric: true })),
]

export const Route = createFileRoute("/_layout/leagues/$league/stats")({
	component: RouteComponent,
	validateSearch: z.object({
		page: z.number().int().min(1).default(1),
		sortBy: z.enum(CAREER_STAT_FIELD_KEYS).default("runs"),
		sortDir: z.enum(["asc", "desc"]).default("desc"),
	}),
	loaderDeps: ({ search: { page, sortBy, sortDir } }) => ({
		page,
		sortBy,
		sortDir,
	}),
	loader: async ({
		context: { trpc },
		params: { league },
		deps: { page, sortBy, sortDir },
	}) => {
		const [stats, leagueInfo] = await Promise.all([
			trpc.leagues.careerStats.query({
				slug: league,
				sortBy,
				sortDir,
				page,
				pageSize: PAGE_SIZE,
			}),
			trpc.leagues.league.query({ slug: league }),
		])

		return { stats, leagueInfo }
	},
})

function RouteComponent() {
	const { stats, leagueInfo } = Route.useLoaderData()
	const { league } = Route.useParams()
	const { sortBy, sortDir } = Route.useSearch()
	const navigate = Route.useNavigate()

	// Whatever page you were on may not make sense under the new sort
	// (or may simply not exist if the new order has fewer pages worth
	// looking at before finding what you're after) - so re-sorting
	// always jumps back to page 1.
	function toggleSort(key: CareerStatField) {
		const nextDir = sortBy === key && sortDir === "desc" ? "asc" : "desc"
		navigate({
			search: (prev) => ({ ...prev, sortBy: key, sortDir: nextDir, page: 1 }),
			resetScroll: false,
		})
	}

	return (
		<div
			className={css({
				maxWidth: "5xl",
				mx: "auto",
				px: "8",
			})}
		>
			<Breadcrumb>
				<Breadcrumb.Item>
					<Breadcrumb.Link to="/">Leagues</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.Link to="/leagues/$league">
						{leagueInfo.name}
					</Breadcrumb.Link>
					<Breadcrumb.Divider />
				</Breadcrumb.Item>
				<Breadcrumb.Item>
					<Breadcrumb.CurrentLink>Career Stats</Breadcrumb.CurrentLink>
				</Breadcrumb.Item>
			</Breadcrumb>
			<div
				className={css({
					display: "flex",
					flexDir: "column",
					gap: "2",
					pt: "4",
					pb: "6",
				})}
			>
				<h1
					className={css({
						fontFamily: "heading",
						fontWeight: "800",
						fontSize: "3xl",
					})}
				>
					Career stats
				</h1>
				<p className={css({ color: "subtitle", fontSize: "sm" })}>
					Every player who's logged a game at Cheviot Hills, across all seasons.
					Click a column to sort. For one season's numbers, go to that season's
					page instead.
				</p>
			</div>
			<Table sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
				<Table.Head columns={columns} />
				<Table.Body>
					{stats.players.map((player) => (
						<Table.Row key={player.userId}>
							<Table.Cell>
								<Link
									to="/user/$userId"
									params={{ userId: player.userId }}
									className={css({
										color: "purple.dark",
										fontWeight: "800",
										fontFamily: "heading",
										_hover: {
											textDecoration: "underline",
										},
									})}
								>
									{player.firstName} {player.lastName}
								</Link>
							</Table.Cell>
							{player.stats.map(({ key, value }) => (
								<Table.Cell key={key} numeric>
									{RATE_FIELDS.has(key) ? value.toFixed(3) : value}
								</Table.Cell>
							))}
						</Table.Row>
					))}
				</Table.Body>
			</Table>
			<Table.Pagination
				page={stats.page}
				totalPages={stats.totalPages}
				renderLink={(page, children, className) => (
					<Link
						to="/leagues/$league/stats"
						params={{ league }}
						search={(prev) => ({ ...prev, page })}
						className={className}
					>
						{children}
					</Link>
				)}
			/>
		</div>
	)
}
