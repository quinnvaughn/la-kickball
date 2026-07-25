import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"

type Props = {
	heading: string
	children: React.ReactNode
	stretch?: boolean
}

export function SectionBlock({ heading, children, stretch = false }: Props) {
	return (
		<section
			className={css({
				py: "10",
			})}
		>
			<VStack alignItems={stretch ? "stretch" : "start"} gap="5">
				<h2
					className={css({
						fontSize: "2xl",
						fontWeight: "bold",
						fontFamily: "heading",
					})}
				>
					{heading}
				</h2>
				{children}
			</VStack>
		</section>
	)
}
