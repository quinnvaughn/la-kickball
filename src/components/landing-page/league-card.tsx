import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"

type Props = {
	league: string
	name: string
}

export function LeagueCard({ league, name }: Props) {
	return (
		<Link
			to="/leagues/$league"
			params={{ league }}
			className={css({
				textDecoration: "none",
				display: "block",
				background: "#fff",
				border: {
					base: "1px solid rgba(27,42,74,0.12)",
					_hover: "1px solid var(--colors-purple)",
				},
				borderRadius: "2xl",
				p: "6",
			})}
		>
			<VStack gap="1" alignItems="start">
				<div
					className={css({
						fontFamily: "heading",
						fontWeight: "700",
						fontSize: "xl",
					})}
				>
					{name}
				</div>
				<p
					className={css({
						fontSize: "sm",
						color: "rgba(27,42,74,0.6)",
					})}
				>
					1 season running
				</p>
			</VStack>
		</Link>
	)
}
