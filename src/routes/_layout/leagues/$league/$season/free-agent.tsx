import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
	"/_layout/leagues/$league/$season/free-agent",
)({
	component: RouteComponent,
})

function RouteComponent() {
	return <div>Hello "/_layout/leagues/$league/$season/free-agent"!</div>
}
