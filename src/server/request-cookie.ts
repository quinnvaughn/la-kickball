import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

// Lets the loader's tRPC client (an internal HTTP call to /api/trpc, see
// ./client.ts) forward the visitor's session cookie, so ctx.user is
// populated during SSR just like it is for same-origin browser requests.
export const getRequestCookieHeader = createServerFn({ method: "GET" }).handler(
	() => getRequestHeader("cookie") ?? null,
)
