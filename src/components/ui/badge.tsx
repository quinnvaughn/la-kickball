import { css, cx } from "styled-system/css"

type Props = {
	text: string
	color?: "teal" | "gold"
	dot?: boolean
	className?: string
}

export function Badge({ text, color = "teal", dot = false, className }: Props) {
	return (
		<span
			className={cx(
				css({
					display: "inline-flex",
					alignSelf: "flex-start",
					alignItems: "center",
					gap: "1.5",
					fontFamily: "label",
					fontSize: "xs",
					textTransform: "uppercase",
					letterSpacing: "wider",
					fontWeight: "700",
					py: "1",
					px: "2",
					borderRadius: "full",
					background:
						color === "gold" ? "rgba(255,182,39,0.15)" : "rgba(0,169,157,0.12)",
					color: color === "gold" ? "gold.dark" : "teal.dark",
					...(dot && {
						_before: {
							content: '""',
							display: "inline-block",
							width: "1.5",
							height: "1.5",
							borderRadius: "full",
							background: "currentColor",
						},
					}),
				}),
				className,
			)}
		>
			{text}
		</span>
	)
}
