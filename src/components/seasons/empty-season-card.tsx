import { css } from "styled-system/css"

type Props = {
	message: string
}

export function EmptySeasonCard({ message }: Props) {
	return (
		<div
			className={css({
				background: "#fff",
				border: "1px dashed rgba(27,42,74,0.25)",
				borderRadius: "2xl",
				padding: "8",
				textAlign: "center",
			})}
		>
			<p className={css({ color: "rgba(27,42,74,0.6)" })}>{message}</p>
		</div>
	)
}
