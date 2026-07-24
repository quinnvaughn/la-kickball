import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch"
import { db } from "./db"
import {
	hashSessionToken,
	SESSION_COOKIE_NAME,
	SESSION_TTL_MS,
} from "./domain/auth"
import { serializeCookie } from "./domain/cookie"

function parseCookies(
	header: string | undefined | null,
): Record<string, string> {
	if (!header) return {}

	return Object.fromEntries(
		header.split(";").map((pair) => {
			const [key, ...rest] = pair.trim().split("=")
			return [key, decodeURIComponent(rest.join("="))]
		}),
	)
}

async function getAuthFromCookie(cookieHeader: string | undefined | null) {
	const token = parseCookies(cookieHeader)[SESSION_COOKIE_NAME]
	if (!token) return null

	const session = await db.query.sessions.findFirst({
		where: { tokenHash: { eq: hashSessionToken(token) } },
		with: { user: true },
	})

	if (!session || session.expiresAt < new Date()) return null

	return { session, user: session.user }
}

const isProduction = process.env.NODE_ENV === "production"

// Used by both server entrypoints (the Express server in server.ts, and
// the fetch-based /api/trpc route TanStack Start's own server uses) so
// login/logout/register mutations can set the session cookie without
// caring which adapter is handling the request.
export async function createExpressContext({
	req,
	res,
}: CreateExpressContextOptions) {
	const auth = await getAuthFromCookie(req.headers.cookie)

	return {
		db,
		user: auth?.user ?? null,
		session: auth?.session ?? null,
		setSessionCookie: (token: string) => {
			res.cookie(SESSION_COOKIE_NAME, token, {
				httpOnly: true,
				secure: isProduction,
				sameSite: "lax" as const,
				maxAge: SESSION_TTL_MS,
				path: "/",
			})
		},
		clearSessionCookie: () => {
			res.clearCookie(SESSION_COOKIE_NAME, { path: "/" })
		},
	}
}

export async function createFetchContext({
	req,
	resHeaders,
}: FetchCreateContextFnOptions) {
	const auth = await getAuthFromCookie(req.headers.get("cookie"))

	return {
		db,
		user: auth?.user ?? null,
		session: auth?.session ?? null,
		setSessionCookie: (token: string) => {
			resHeaders.append(
				"Set-Cookie",
				serializeCookie(SESSION_COOKIE_NAME, token, {
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					maxAge: SESSION_TTL_MS / 1000,
					path: "/",
				}),
			)
		},
		clearSessionCookie: () => {
			resHeaders.append(
				"Set-Cookie",
				serializeCookie(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" }),
			)
		},
	}
}

export type Context = Awaited<ReturnType<typeof createExpressContext>>
