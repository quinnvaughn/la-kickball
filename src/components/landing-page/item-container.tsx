import { css } from "styled-system/css"

export function ItemContainer({ children }: { children: React.ReactNode }) {
	return (
		<div
			className={css({
				background: "#fff",
				borderRadius: "2xl",
				p: "6",
				border: "1px solid rgba(27,42,74,0.12)",
				display: "flex",
				flexDirection: "column",
				alignItems: "start",
				gap: "1.5",
			})}
		>
			{children}
		</div>
	)
}
