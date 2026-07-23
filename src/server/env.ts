import { z } from "zod"

const serverEnvSchema = z.object({
	DATABASE_URL: z
		.string()
		.min(1)
		.default("postgres://postgres:postgres@localhost:5432/la_kickball"),
})

function readEnvValue(key: string) {
	const viteEnv =
		typeof import.meta !== "undefined" && "env" in import.meta
			? (
					import.meta as ImportMeta & {
						env?: Record<string, string | undefined>
					}
				).env
			: undefined

	return viteEnv?.[key] ?? process.env?.[key]
}

export function getServerEnv() {
	return serverEnvSchema.parse({
		DATABASE_URL: readEnvValue("DATABASE_URL"),
	})
}
