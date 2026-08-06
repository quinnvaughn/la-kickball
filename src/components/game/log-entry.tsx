import { css, cx } from "styled-system/css"
import { match } from "ts-pattern"
import type { GamePlayLogEntry } from "#/server/domain/game-plays"
import { formatPlay } from "./format-play"

type Props = {
	play: GamePlayLogEntry
}

const baseStyle = css({
	position: "absolute",
	width: "7px",
	height: "7px",
	transform: "rotate(45deg)",
	border: "1px solid rgba(27,42,74,0.25)",
})

const occupiedBaseStyle = css({
	background: "purple",
	borderColor: "purple.dark",
})

function formatOutsInHalf(outsInHalf: number) {
	return match(outsInHalf)
		.with(0, () => "No outs")
		.with(1, () => "1 out")
		.with(2, () => "2 outs")
		.otherwise(() => "3 outs")
}

export function LogEntry({ play }: Props) {
	const [onFirst, onSecond, onThird] = play.bases
	const didScore =
		play.outcome === "homer" || play.runners.some((runner) => runner.result === "scored")
	return (
		<div
			className={css({
				py: "2",
				display: "flex",
				gap: "4",
				alignItems: "center",
				borderTopColor: "border",
				borderTopWidth: "1px",
				borderTopStyle: "solid",
			})}
		>
			<span className={css({ fontSize: "sm", flex: 1, minWidth: 0 })}>
				{formatPlay(play)}
			</span>
			<div
				className={css({
					display: "flex",
					alignItems: "center",
					gap: "4",
					flexShrink: 0,
					fontFamily: "label",
					fontSize: "xs",
				})}
			>
				<span
					className={css({
						position: "relative",
						width: "21px",
						height: "21px",
						flexShrink: 0,
					})}
				>
					<i
						className={cx(
							css({ top: "1px", left: "7px" }),
							baseStyle,
							onSecond && occupiedBaseStyle,
						)}
					/>
					<i
						className={cx(
							css({ top: "8px", left: "0px" }),
							baseStyle,
							onThird && occupiedBaseStyle,
						)}
					/>
					<i
						className={cx(
							css({ top: "8px", left: "14px" }),
							baseStyle,
							onFirst && occupiedBaseStyle,
						)}
					/>
				</span>
				<span
					className={css({
						color: "subtitle",
						width: "3.4rem",
						textAlign: "right",
						whiteSpace: "nowrap",
					})}
				>
					{formatOutsInHalf(play.outsInHalf)}
				</span>
				<span
					className={css({
						color: didScore ? "gold.dark" : "subtitle",
						fontWeight: didScore ? "bold" : undefined,
						width: "3.6rem",
						textAlign: "right",
						whiteSpace: "nowrap",
					})}
				>
					{play.awayScore}-{play.homeScore}
				</span>
			</div>
		</div>
	)
}
