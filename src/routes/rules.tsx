import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/rules")({
	component: Rules,
})

function Rules() {
	return <div>Rules</div>
}
