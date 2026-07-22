import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/leagues/$leagueId")({
	component: League,
})

function League() {
	const { leagueId } = Route.useParams()

	return <div>League {leagueId}</div>
}
