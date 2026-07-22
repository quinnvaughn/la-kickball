import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/leagues/$slug")({
	component: League,
})

function League() {
	const { slug } = Route.useParams()

	return <div>League {slug}</div>
}
