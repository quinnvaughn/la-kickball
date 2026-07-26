import { css } from "styled-system/css"

type Props = {
	text: string
}

export function Badge({ text }: Props) {
	return (
		<span
			className={css({
				display: "inline-block",
				fontFamily: "label",
				fontSize: "xs",
				textTransform: "uppercase",
				letterSpacing: "wider",
				py: "1",
				px: "2",
				borderRadius: "full",
				background: "rgba(0,169,157,0.12)",
				color: "teal.dark",
			})}
		>
			{" "}
			{text}
		</span>
	)
}
