import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import { getServerEnv } from "./env"
import type { AppRouter } from "./router"

const { VITE_TRPC_URL } = getServerEnv()

export const trpc = createTRPCProxyClient<AppRouter>({
	links: [
		httpBatchLink({
			url: VITE_TRPC_URL,
			transformer: superjson,
		}),
	],
})
