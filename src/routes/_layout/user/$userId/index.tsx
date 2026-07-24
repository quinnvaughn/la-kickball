import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/user/$userId/")({
	component: RouteComponent,
})

function RouteComponent() {
	return <div>Hello "/_layout/user/$userId/"!</div>
}
