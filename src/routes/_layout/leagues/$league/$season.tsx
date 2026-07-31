import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/leagues/$league/$season")({
	component: SeasonLayout,
	loader: async ({ context: { trpc }, params: { league, season } }) => {
		return trpc.seasons.bySlug.query({ leagueSlug: league, seasonSlug: season })
	},
})

function SeasonLayout() {
	return <Outlet />
}
