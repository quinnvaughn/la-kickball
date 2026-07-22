import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { VStack } from "styled-system/jsx"

type Props = {
	leagueId: string
	name: string
	division: string
	status: string
}

export function LeagueCard({ leagueId, name, division, status }: Props) {
	return (
		<Link
			to="/leagues/$leagueId"
			params={{ leagueId }}
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
					{division}
				</p>
				<div
					className={css({
						display: "inline-block",
						fontFamily: "label",
						textTransform: "uppercase",
						fontSize: "xs",
						letterSpacing: "wider",
						color: "teal.dark",
						background: "rgba(0,169,157,0.12)",
						py: "1",
						px: "2.5",
						borderRadius: "full",
					})}
				>
					{status}
				</div>
			</VStack>
		</Link>
	)
}
