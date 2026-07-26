import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { createTrpc, trpc } from "./server/client"
import { getRequestCookieHeader } from "./server/request-cookie"

export async function getRouter() {
	const cookie =
		typeof window === "undefined" ? await getRequestCookieHeader() : null

	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		context: {
			trpc: cookie ? createTrpc(cookie) : trpc,
		},
	})

	return router
}

declare module "@tanstack/react-router" {
	interface Register {
		router: Awaited<ReturnType<typeof getRouter>>
	}
}
