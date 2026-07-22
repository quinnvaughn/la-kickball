import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"

export function Logo() {
	return (
		<Link
			to="/"
			className={css({
				color: "sand",
				fontSize: "lg",
				textDecoration: "none",
				fontWeight: "800",
				fontFamily: "heading",
			})}
		>
			Los Angeles Kickball
		</Link>
	)
}
