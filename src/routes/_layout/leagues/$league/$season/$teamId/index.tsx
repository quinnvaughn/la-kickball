import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_layout/leagues/$league/$season/$teamId/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_layout/leagues/$league/$season/$teamId/"!</div>
}
