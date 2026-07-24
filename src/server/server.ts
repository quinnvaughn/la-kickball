import path from "node:path"
import { fileURLToPath } from "node:url"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import express from "express"
import { createExpressContext } from "./context"
import { appRouter } from "./router"

const PORT =
	typeof process.env.PORT !== "undefined" ? Number(process.env.PORT) : 3000
const isTest =
	process.env.NODE_ENV === "test" || Boolean(process.env.VITE_TEST_BUILD)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function createServer() {
	const app = express()

	app.use(
		"/api/trpc",
		createExpressMiddleware({
			router: appRouter,
			createContext: createExpressContext,
		}),
	)

	app.use(express.static(path.resolve(__dirname, "../client")))

	app.get("/{*splat}", (_req, res) => {
		res.sendFile(path.resolve(__dirname, "../client", "index.html"))
	})

	return { app }
}

if (import.meta.url === `file://${process.argv[1]}`) {
	if (!isTest) {
		const { app } = createServer()
		app.listen(PORT, () => {
			console.info(`Server available at: http://localhost:${PORT}`)
		})
	}
}
