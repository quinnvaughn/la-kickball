import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createExpressMiddleware } from "@trpc/server/adapters/express"
import express from "express"
import { appRouter } from "./router"
import { createTRPCContext } from "./trpc"

const PORT =
	typeof process.env.PORT !== "undefined" ? Number(process.env.PORT) : 3000
const HMR_PORT =
	typeof process.env.HMR_PORT !== "undefined"
		? Number(process.env.HMR_PORT)
		: 3001
const isTest =
	process.env.NODE_ENV === "test" || Boolean(process.env.VITE_TEST_BUILD)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function createServer(
	root = process.cwd(),
	isProd = process.env.NODE_ENV === "production",
) {
	const app = express()

	app.use(
		"/api/trpc",
		createExpressMiddleware({
			router: appRouter,
			createContext: createTRPCContext,
		}),
	)

	if (!isProd) {
		const vite = await import("vite")
		const viteServer = await vite.createServer({
			root,
			logLevel: isTest ? "error" : "info",
			server: {
				middlewareMode: true,
				watch: {
					usePolling: true,
					interval: 100,
				},
				hmr: {
					port: HMR_PORT,
				},
			},
			appType: "custom",
		})

		app.use(viteServer.middlewares)

		app.get("/{*splat}", async (req, res, next) => {
			try {
				let html = await fs.readFile(path.resolve(root, "index.html"), "utf-8")
				html = await viteServer.transformIndexHtml(req.originalUrl ?? "/", html)
				res.status(200).setHeader("content-type", "text/html").end(html)
			} catch (error) {
				next(error)
			}
		})

		return { app }
	}

	app.use(express.static(path.resolve(__dirname, "../client")))

	app.get("/{*splat}", (_req, res) => {
		res.sendFile(path.resolve(__dirname, "../client", "index.html"))
	})

	return { app }
}

if (import.meta.url === `file://${process.argv[1]}`) {
	if (!isTest) {
		createServer().then(({ app }) => {
			app.listen(PORT, () => {
				console.info(`Server available at: http://localhost:${PORT}`)
			})
		})
	}
}
