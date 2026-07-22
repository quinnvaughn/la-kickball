import { css } from "styled-system/css"
import { HStack } from "styled-system/jsx"
import { Logo } from "./logo"
import { NavLink } from "./nav-link"
import { container } from "./nav-styling"

export function Footer() {
	return (
		<div className={css({ py: "4", px: "8" })}>
			<footer className={container}>
				<Logo />
				<HStack gap="3">
					<NavLink to="/rules">Rules</NavLink>
					<NavLink external href="mailto:qvaughn3@gmail.com">
						Contact
					</NavLink>
				</HStack>
			</footer>
		</div>
	)
}
