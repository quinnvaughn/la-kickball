import { useState } from "react"
import { css } from "styled-system/css"
import { formatHalfInning } from "./format-half-inning"
import type { HalfInning } from "./game-logs-tab"
import { LogEntry } from "./log-entry"

type Props = {
	halfInning: HalfInning
	isOpen: boolean
}

export function HalfInningGroup({ halfInning, isOpen }: Props) {
	const [isOpenState, setIsOpen] = useState(isOpen)
	return (
		<div
			className={css({
				background: "#fff",
				borderColor: "border",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "xl",
				overflow: "hidden",
				width: "100%",
			})}
		>
			<button
				type="button"
				className={css({
					width: "100%",
					display: "flex",
					alignItems: "center",
					gap: "4",
					textAlign: "left",
					py: "3",
					px: "4",
					background: "transparent",
					cursor: "pointer",
				})}
				onClick={() => {
					setIsOpen((prev) => !prev)
				}}
			>
				<span
					className={css({
						fontFamily: "label",
						fontSize: "xs",
						flexShrink: 0,
						color: "subtitle",
						width: "6.4rem",
					})}
				>
					{formatHalfInning(halfInning)}
				</span>
				<span
					className={css({
						fontWeight: "bold",
						fontFamily: "heading",
						color: "purple",
					})}
				>
					{halfInning.battingTeamName}
				</span>
				<span
					className={css({
						marginLeft: "auto",
						fontFamily: "label",
						fontSize: "xs",
						color: "subtitle",
						whiteSpace: "nowrap",
					})}
				>
					{halfInning.runs === 0
						? "No runs"
						: `${halfInning.runs} ${halfInning.runs === 1 ? "run" : "runs"}`}
				</span>
				<span
					className={css({
						width: "8px",
						height: "8px",
						flexShrink: 0,
						borderRight: "2px solid",
						borderBottom: "2px solid",
						borderColor: "subtitle",
						transform: isOpenState
							? "rotate(225deg) translate(-2px, -2px)"
							: "rotate(45deg) translate(-2px, -2px)",
						transition: "transform 0.15s",
					})}
				/>
			</button>
			<div
				className={css({ display: isOpenState ? "block" : "none", px: "4" })}
			>
				{halfInning.plays.map((play) => (
					<LogEntry key={play.id} play={play} />
				))}
			</div>
		</div>
	)
}
