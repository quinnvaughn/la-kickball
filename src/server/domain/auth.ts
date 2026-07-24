import { createHash, randomBytes } from "node:crypto"
import argon2 from "argon2"

export const SESSION_COOKIE_NAME = "session"
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export function hashPassword(password: string): Promise<string> {
	return argon2.hash(password)
}

export function verifyPassword(
	passwordHash: string,
	password: string,
): Promise<boolean> {
	return argon2.verify(passwordHash, password)
}

export function generateSessionToken(): string {
	return randomBytes(32).toString("base64url")
}

// Only this hash is ever stored — the raw token lives solely in the
// user's cookie, so a DB leak alone can't be replayed as a session.
export function hashSessionToken(token: string): string {
	return createHash("sha256").update(token).digest("hex")
}

export function sessionExpiryFromNow(): Date {
	return new Date(Date.now() + SESSION_TTL_MS)
}
