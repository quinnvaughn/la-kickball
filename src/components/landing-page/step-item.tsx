import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"
import { ItemContainer } from "./item-container"

type Props = {
	heading: string
	text: string
	number: number
}

export function StepItem({ heading, text, number }: Props) {
	return (
		<ItemContainer>
			<VStack gap="3" alignItems="start">
				<div
					className={css({
						fontFamily: "label",
						fontWeight: "700",
						color: "sand",
						background: "coral",
						width: "26px",
						height: "26px",
						borderRadius: "50%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					})}
				>
					{number}
				</div>
				<h3
					className={css({
						fontFamily: "heading",
						fontWeight: "700",
						fontSize: "lg",
						color: "purple.dark",
					})}
				>
					{heading}
				</h3>
				<p
					className={css({
						color: "rgba(27,42,74,0.6)",
						lineHeight: "1.5",
						fontSize: "sm",
					})}
				>
					{text}
				</p>
			</VStack>
		</ItemContainer>
	)
}
