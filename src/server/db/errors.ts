// Postgres unique_violation — https://www.postgresql.org/docs/current/errcodes-appendix.html
export function isUniqueConstraintError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "23505"
	)
}
