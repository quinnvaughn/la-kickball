import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import type { SeasonMvp, WeekMvp } from "#/server/domain/schedule"
import { formatStat } from "#/server/domain/stats"
import { formatUsersName } from "../user/utils"

type WeekProps = {
	mvp: WeekMvp
	category: "week"
}

type SeasonMVPProps = {
	mvp: SeasonMvp
	category: "season"
}

type Props = WeekProps | SeasonMVPProps

export function MVPCard({ mvp, category = "week" }: Props) {
	return (
		<div
			className={css({
				background: "rgba(255,182,39,0.1)",
				borderWidth: "2px",
				borderColor: "gold",
				borderStyle: "solid",
				py: "4",
				px: "5",
				borderRadius: "2xl",
				display: "flex",
				flexDir: "column",
				gap: "2",
			})}
		>
			<div
				className={css({
					textTransform: "uppercase",
					fontFamily: "label",
					fontSize: "xs",
					letterSpacing: "wider",
					color: "gold.dark",
				})}
			>
				MVP
			</div>
			<Link
				to="/user/$userId"
				params={{ userId: mvp.userId }}
				className={css({
					fontFamily: "heading",
					fontWeight: "bold",
					fontSize: "xl",
					color: "purple.dark",
					_hover: { textDecoration: "underline" },
				})}
			>
				{formatUsersName(mvp)}
			</Link>
			<div className={css({ fontSize: "sm", color: "subtitle" })}>
				{mvp.teamName}
				{" · "}
				{mvp.hits}/{mvp.atBats}
				{" · "}
				{mvp.topStats.map(
					(ts, i) =>
						`${formatStat(ts.key, ts.perGame)}${i < mvp.topStats.length - 1 ? " · " : ""}`,
				)}
				{category === "season" && " across the regular season"}
			</div>
		</div>
	)
}
