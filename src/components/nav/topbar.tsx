import { css } from "styled-system/css"
import { Navbar } from "./navbar"

export function Topbar() {
	return (
		<div
			className={css({
				py: "6",
				px: "8",
			})}
		>
			<Navbar />
		</div>
	)
}
