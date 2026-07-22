import { css } from "styled-system/css"
import { ItemContainer } from "./item-container"

export function FAQItem({
	question,
	answer,
}: {
	question: string
	answer: string
}) {
	return (
		<ItemContainer>
			<details>
				<summary
					className={css({
						cursor: "pointer",
						listStylePosition: "inside",
						fontFamily: "heading",
						fontSize: "md",
						fontWeight: "bold",
						color: "purple.dark",
					})}
				>
					{question}
				</summary>
				<p
					className={css({
						paddingLeft: "1",
						marginTop: "3",
					})}
				>
					{answer}
				</p>
			</details>
		</ItemContainer>
	)
}
