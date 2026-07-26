import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import type { AppRouter } from "./router"

const url =
	typeof window === "undefined"
		? `http://localhost:${process.env.PORT ?? 3000}/api/trpc`
		: "/api/trpc"

export function createTrpc(cookie?: string | null) {
	return createTRPCProxyClient<AppRouter>({
		links: [
			httpBatchLink({
				url,
				transformer: superjson,
				headers: cookie ? { cookie } : undefined,
			}),
		],
	})
}

export const trpc = createTrpc()
