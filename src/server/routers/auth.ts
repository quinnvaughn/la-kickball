import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import z from "zod"
import { db } from "../db"
import { sessions, type User, users } from "../db/schema"
import {
	generateSessionToken,
	hashPassword,
	hashSessionToken,
	sessionExpiryFromNow,
	verifyPassword,
} from "../domain/auth"
import { protectedProcedure, publicProcedure, router } from "../trpc"

function toPublicUser(user: User) {
	return {
		id: user.id,
		firstName: user.firstName,
		lastName: user.lastName,
		email: user.email,
		isAdmin: user.isAdmin,
	}
}

async function startSession(userId: string) {
	const token = generateSessionToken()
	await db.insert(sessions).values({
		userId,
		tokenHash: hashSessionToken(token),
		expiresAt: sessionExpiryFromNow(),
	})
	return token
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"

export const authRouter = router({
	me: publicProcedure.query(({ ctx }) =>
		ctx.user ? toPublicUser(ctx.user) : null,
	),

	register: publicProcedure
		.input(
			z.object({
				firstName: z.string().min(1).max(60),
				lastName: z.string().min(1).max(60),
				email: z.email(),
				phone: z.string().min(1).max(20),
				password: z.string().min(8),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.users.findFirst({
				where: { email: { eq: input.email } },
			})

			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "An account with that email already exists",
				})
			}

			const [user] = await db
				.insert(users)
				.values({
					firstName: input.firstName,
					lastName: input.lastName,
					email: input.email,
					phone: input.phone,
					passwordHash: await hashPassword(input.password),
				})
				.returning()

			if (!user) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create account",
				})
			}

			ctx.setSessionCookie(await startSession(user.id))

			return toPublicUser(user)
		}),

	login: publicProcedure
		.input(z.object({ email: z.email(), password: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const user = await db.query.users.findFirst({
				where: { email: { eq: input.email } },
			})

			if (!user) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: INVALID_CREDENTIALS_MESSAGE,
				})
			}

			const valid = await verifyPassword(user.passwordHash, input.password)
			if (!valid) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: INVALID_CREDENTIALS_MESSAGE,
				})
			}

			ctx.setSessionCookie(await startSession(user.id))

			return toPublicUser(user)
		}),

	logout: protectedProcedure.mutation(async ({ ctx }) => {
		await db.delete(sessions).where(eq(sessions.id, ctx.session.id))
		ctx.clearSessionCookie()
		return { ok: true }
	}),
})
