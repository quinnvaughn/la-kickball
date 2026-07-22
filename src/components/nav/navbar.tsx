import { css } from "styled-system/css"
import { HStack } from "styled-system/jsx"
import { Logo } from "./logo"
import { NavLink } from "./nav-link"
import { container } from "./nav-styling"

export function Navbar() {
	return (
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
				>
					Sign up
				</button>
			</HStack>
		</nav>
	)
}
