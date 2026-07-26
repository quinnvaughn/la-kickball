import { useState } from "react"
import { css } from "styled-system/css"
import { HStack } from "styled-system/jsx"
import z from "zod"
import { useForm } from "#/lib/form"
import { Modal } from "../ui/modal"
import { TextField } from "../ui/textfield"
import { Logo } from "./logo"
import { NavLink } from "./nav-link"
import { container } from "./nav-styling"

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

export function Navbar() {
	const [isAuthOpen, setIsAuthOpen] = useState(false)

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
	})

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

	return (
		<>
			<nav className={container}>
				<Logo />
				<HStack gap="3">
					<NavLink to="/rules">Rules</NavLink>
					<button
						type="button"
						className={css({
							background: { base: "coral", _hover: "coral.dark" },
							color: "sand",
							fontWeight: "bold",
							py: "2",
							px: "5",
							borderRadius: "full",
							fontSize: "sm",
							textDecoration: "none",
							cursor: "pointer",
							whiteSpace: "nowrap",
						})}
						onClick={() => setIsAuthOpen(true)}
					>
						Sign up
					</button>
				</HStack>
			</nav>
			<form.Subscribe selector={(s) => s.values.mode}>
				{(mode) => (
					<Modal open={isAuthOpen} onClose={() => setIsAuthOpen(false)}>
						<Modal.Header>
							<Modal.Title>{headerText(mode).title}</Modal.Title>
							<Modal.Subtitle>{headerText(mode).subtitle}</Modal.Subtitle>
						</Modal.Header>
						<Modal.Body>
							<form.Field name="firstName">
								{(field) => (
									<TextField {...field} error={field.meta.error}>
										<TextField.Label>First name</TextField.Label>
										<TextField.Input />
										<TextField.Error />
									</TextField>
								)}
							</form.Field>
						</Modal.Body>
						<Modal.Footer>
							<Modal.SubmitButton>
								{mode === "signup" ? "Sign up" : "Log in"}
							</Modal.SubmitButton>
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
		</>
	)
}
