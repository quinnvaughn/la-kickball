import { useRouter } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { css } from "styled-system/css"
import { HStack, VStack } from "styled-system/jsx"
import z from "zod"
import { useForm } from "#/lib/form"
import { closeModal } from "#/lib/modal"
import { trpc } from "#/server/client"
import { Modal } from "../ui/modal"
import { TextField } from "../ui/textfield"

const formErrorStyles = css({
	fontSize: "xs",
	color: "coral.dark",
	fontWeight: "medium",
	textAlign: "center",
})

type Page = "signup" | "login"

const loginSchema = z.object({
	mode: z.literal("login"),
	email: z.email(),
	password: z.string().min(1, "Password is required."),
})

const signupSchema = loginSchema.extend({
	mode: z.literal("signup"),
	firstName: z
		.string()
		.min(1, "First name is required")
		.max(60, "First name must not be more than 60 characters."),
	lastName: z
		.string()
		.min(1, "Last name is required")
		.max(60, "Last name must not be more than 60 characters."),
	phone: z
		.string()
		.min(1, "Phone number is required")
		.max(20, "Phone number must not be more than 20 characters."),
	password: z.string().min(8, "Password must be at least 8 characters."),
})

const authSchema = z.discriminatedUnion("mode", [loginSchema, signupSchema])

function headerText(page: Page) {
	return page === "signup"
		? { title: "Create your account", subtitle: "" }
		: { title: "Log in", subtitle: "Welcome back" }
}

function footerText(page: Page) {
	return page === "signup"
		? { prompt: "Already have an account?", link: "Log in" }
		: { prompt: "Need an account?", link: "Sign up" }
}

export function AuthModal() {
	const router = useRouter()

	const form = useForm({
		schema: authSchema,
		defaultValues: {
			mode: "signup",
			email: "",
			password: "",
			firstName: "",
			lastName: "",
			phone: "",
		},
		onSubmit: async (values, helpers) => {
			try {
				if (values.mode === "signup") {
					await trpc.auth.register.mutate({
						firstName: values.firstName,
						lastName: values.lastName,
						email: values.email,
						phone: values.phone,
						password: values.password,
					})
				} else {
					await trpc.auth.login.mutate({
						email: values.email,
						password: values.password,
					})
				}

				await router.invalidate()
				closeModal()
			} catch (err) {
				const message =
					err instanceof TRPCClientError
						? err.message
						: "Something went wrong. Please try again."
				helpers.setFormError(message)
			}
		},
	})

	return (
		<form onSubmit={form.handleSubmit}>
			<form.Subscribe selector={(s) => s.values.mode}>
				{(mode) => (
					<Modal open onClose={closeModal}>
						<Modal.Header>
							<Modal.Title>{headerText(mode).title}</Modal.Title>
							<Modal.Subtitle>{headerText(mode).subtitle}</Modal.Subtitle>
						</Modal.Header>
						<Modal.Body>
							<VStack alignItems="start" width="100%" gap="2">
								{mode === "signup" && (
									<form.Field name="firstName">
										{(field) => (
											<TextField {...field} error={field.meta.error} required>
												<TextField.Label>First name</TextField.Label>
												<TextField.Input />
												<TextField.Error />
											</TextField>
										)}
									</form.Field>
								)}
								{mode === "signup" && (
									<form.Field name="lastName">
										{(field) => (
											<TextField {...field} error={field.meta.error} required>
												<TextField.Label>Last name</TextField.Label>
												<TextField.Input />
												<TextField.Error />
											</TextField>
										)}
									</form.Field>
								)}
								<form.Field name="email">
									{(field) => (
										<TextField
											{...field}
											error={field.meta.error}
											type="email"
											required
										>
											<TextField.Label>Email</TextField.Label>
											<TextField.Input />
											<TextField.Error />
										</TextField>
									)}
								</form.Field>
								{mode === "signup" && (
									<form.Field name="phone">
										{(field) => (
											<TextField
												{...field}
												error={field.meta.error}
												type="tel"
												required
											>
												<TextField.Label>Phone Number</TextField.Label>
												<TextField.Input />
												<TextField.Hint>
													So your team can contact you.
												</TextField.Hint>
												<TextField.Error />
											</TextField>
										)}
									</form.Field>
								)}
								<form.Field name="password">
									{(field) => (
										<TextField {...field} error={field.meta.error} required>
											<TextField.Label>Password</TextField.Label>
											<TextField.PasswordInput />
											<TextField.Error />
										</TextField>
									)}
								</form.Field>
							</VStack>
						</Modal.Body>
						<Modal.Footer>
							<form.Subscribe selector={(s) => s.meta.formError}>
								{(formError) =>
									formError && (
										<p className={formErrorStyles}>{formError}</p>
									)
								}
							</form.Subscribe>
							<form.Subscribe
								selector={(s) =>
									[s.meta.canSubmit, s.meta.isSubmitting] as const
								}
							>
								{([canSubmit, isSubmitting]) => (
									<Modal.SubmitButton disabled={!canSubmit || isSubmitting}>
										{mode === "signup" ? "Sign up" : "Log in"}
									</Modal.SubmitButton>
								)}
							</form.Subscribe>
							<HStack gap="1" justify={"center"}>
								<Modal.SwitchPrompt>
									{footerText(mode).prompt}
								</Modal.SwitchPrompt>
								<Modal.SwitchLink
									onClick={() =>
										form.setValue("mode", (prev) =>
											prev === "signup" ? "login" : "signup",
										)
									}
								>
									{footerText(mode).link}
								</Modal.SwitchLink>
							</HStack>
						</Modal.Footer>
					</Modal>
				)}
			</form.Subscribe>
		</form>
	)
}
