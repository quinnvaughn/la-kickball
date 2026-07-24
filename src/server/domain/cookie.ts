export interface CookieOptions {
	maxAge?: number // seconds
	path?: string
	httpOnly?: boolean
	secure?: boolean
	sameSite?: "lax" | "strict" | "none"
}

// Only needed by the fetch-based tRPC adapter, which hands back a plain
// Response rather than an object with a res.cookie()/res.clearCookie()
// helper (Express gets those for free, see context.ts).
export function serializeCookie(
	name: string,
	value: string,
	options: CookieOptions = {},
): string {
	const parts = [`${name}=${encodeURIComponent(value)}`]

	if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
	if (options.path) parts.push(`Path=${options.path}`)
	if (options.httpOnly) parts.push("HttpOnly")
	if (options.secure) parts.push("Secure")
	if (options.sameSite) {
		const sameSite =
			options.sameSite[0].toUpperCase() + options.sameSite.slice(1)
		parts.push(`SameSite=${sameSite}`)
	}

	return parts.join("; ")
}
