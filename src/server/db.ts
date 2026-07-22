import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { relations } from "./db/schema"
import { getServerEnv } from "./env"

const { DATABASE_URL } = getServerEnv()
const client = postgres(DATABASE_URL)

export const db = drizzle({ client, relations })
