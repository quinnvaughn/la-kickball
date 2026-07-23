import { Link } from "@tanstack/react-router"
import { css, cx } from "styled-system/css"
import type { SeasonWithStatus } from "#/server/domain/seasons"
import { sharedCardStyles } from "./styles"
import { formatDivision, formatSeasonName } from "./utils"

type Props = {
	season: SeasonWithStatus
	league: string
}

export function SeasonRow({ season, league }: Props) {
	return (
		<Link
			to="/leagues/$league/$season"
			params={{ league, season: season.slug }}
			className={cx(
				sharedCardStyles,
				css({
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}),
			)}
		>
			<span className={css({ fontFamily: "heading", fontWeight: "bold" })}>
				{formatSeasonName(season)} · {formatDivision(season.division)}
			</span>
			<span className={css({ fontSize: "sm", color: "subtitle" })}>
				Winner:{" "}
				<strong className={css({ color: "purple.dark" })}>
					Kicking Cobras
				</strong>
			</span>
		</Link>
	)
}
