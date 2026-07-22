import { css } from "styled-system/css"
import { ItemContainer } from "./item-container"

type Props = {
	heading: string
	text: string
}

export function BenefitItem({ heading, text }: Props) {
	return (
		<ItemContainer>
			<h3
				className={css({
					fontFamily: "heading",
					fontWeight: "700",
					fontSize: "xl",
					color: "purple.dark",
				})}
			>
				{heading}
			</h3>
			<p
				className={css({
					fontSize: "sm",
					color: "rgba(27,42,74,0.6)",
					lineHeight: "1.5",
				})}
			>
				{text}
			</p>
		</ItemContainer>
	)
}
