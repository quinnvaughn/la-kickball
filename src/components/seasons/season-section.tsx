import type React from "react"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"

type Props = {
	heading: string
	children: React.ReactNode
	borderBottom?: boolean
}

export function SeasonSection({
	heading,
	children,
	borderBottom = true,
}: Props) {
	return (
		<section
			className={css({
				py: "10",
				borderBottom: borderBottom
					? "1px solid rgba(27,42,74,0.08)"
					: undefined,
			})}
		>
			<VStack alignItems="start" gap="5">
				<h2
					className={css({
						fontFamily: "heading",
						fontWeight: "700",
						fontSize: "2xl",
					})}
				>
					{heading}
				</h2>
				{children}
			</VStack>
		</section>
	)
}
