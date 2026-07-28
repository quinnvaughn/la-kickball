import { css } from "styled-system/css"

type Props = {
	children: React.ReactNode | React.ReactNode[]
}

export function EmptyTabContainer({ children }: Props) {
	return (
		<div
			className={css({
				background: "#fff",
				borderWidth: "1px",
				borderColor: "border",
				borderStyle: "dashed",
				padding: "8",
				textAlign: "center",
				borderRadius: "2xl",
			})}
		>
			{children}
		</div>
	)
}
