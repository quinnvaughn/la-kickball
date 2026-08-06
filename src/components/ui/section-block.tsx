import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"

type Props = {
	heading: string
	children: React.ReactNode
	stretch?: boolean
	bottomBorder?: boolean
	subtitle?: string
}

export function SectionBlock({
	heading,
	children,
	subtitle,
	stretch = false,
	bottomBorder = false,
}: Props) {
	return (
		<section
			className={css({
				py: "8",
				width: "100%",
				borderBottomColor: bottomBorder ? "border" : undefined,
				borderBottomStyle: bottomBorder ? "solid" : undefined,
				borderBottomWidth: bottomBorder ? "1px" : undefined,
			})}
		>
			<VStack alignItems={stretch ? "stretch" : "start"} gap="5">
				<VStack gap="1" alignItems="flex-start">
					<h2
						className={css({
							fontSize: "2xl",
							fontWeight: "bold",
							fontFamily: "heading",
						})}
					>
						{heading}
					</h2>
					{subtitle && (
						<p className={css({ color: "subtitle", fontSize: "sm" })}>
							{subtitle}
						</p>
					)}
				</VStack>
				{children}
			</VStack>
		</section>
	)
}
