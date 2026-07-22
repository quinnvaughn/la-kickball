import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"

export function Hero() {
	return (
		<div
			className={css({
				background:
					"linear-gradient(180deg, #6B4984 0%, #C2497A 45%, #FF6B4A 75%, #FFB627 100%)",
				px: "8",
				py: "16",
			})}
		>
			<VStack
				gap="2"
				alignItems="start"
				className={css({ maxW: "5xl", mx: "auto" })}
			>
				<div
					className={css({
						fontFamily: "label",
						textTransform: "uppercase",
						color: "sand",
						letterSpacing: "widest",
						opacity: "0.85",
						fontSize: "smaller",
					})}
				>
					coed rec kickball
				</div>
				<h1
					className={css({
						fontFamily: "heading",
						fontWeight: "800",
						fontSize: "clamp(2.4rem, 5.5vw, 3.8rem)",
						color: "sand",
						lineHeight: "1.05",
						maxWidth: "26rem",
					})}
				>
					Los Angeles Kickball
				</h1>
				<p
					className={css({
						color: "sand",
						fontSize: "lg",
						lineHeight: "relaxed",
						maxWidth: "30rem",
						opacity: "0.95",
					})}
				>
					Adult coed kickball leagues around LA.
				</p>
			</VStack>
		</div>
	)
}
