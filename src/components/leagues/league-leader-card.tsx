import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { type CareerLeader, isRateCategory } from "#/server/domain/stats"
import { formatUsersName } from "../user/utils"

type Props = {
	leader: CareerLeader
}

function formatStatLabel(stat: string) {
	if (stat !== "extraBasesTaken") return stat
	return stat.replace(/[A-Z]/g, (letter) => ` ${letter}`)
}

function formatStatValue(leader: CareerLeader) {
	return isRateCategory(leader.stat) ? leader.value.toFixed(3) : leader.value
}

export function LeagueLeaderCard({ leader }: Props) {
	return (
		<div
			className={css({
				background: "#fff",
				borderRadius: "2xl",
				borderColor: "border",
				borderStyle: "solid",
				borderWidth: "1px",
				px: "5",
				py: "4",
				display: "flex",
				flexDirection: "column",
				gap: "2",
			})}
		>
			<span
				className={css({
					fontFamily: "heading",
					fontSize: "xs",
					textTransform: "uppercase",
					letterSpacing: "wider",
					color: "gold.dark",
				})}
			>
				{formatStatLabel(leader.stat)}
			</span>
			<Link
				to={"/user/$userId"}
				params={{ userId: leader.userId }}
				className={css({
					fontFamily: "heading",
					fontWeight: "700",
					fontSize: "md",
					_hover: {
						textDecoration: "underline",
					},
				})}
			>
				{formatUsersName(leader)}
			</Link>
			<span
				className={css({
					fontFamily: "label",
					fontSize: "sm",
					color: "subtitle",
				})}
			>
				{formatStatValue(leader)}
			</span>
		</div>
	)
}
