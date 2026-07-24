import postgres from "postgres"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL is required to run the seed")
}

const client = postgres(DATABASE_URL, { max: 1 })

await client.file(new URL("./seed.sql", import.meta.url))

await client.end()
