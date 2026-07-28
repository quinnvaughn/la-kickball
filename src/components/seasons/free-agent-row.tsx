import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { HStack, VStack } from "styled-system/jsx"
import { openModal } from "#/lib/modal"
import type { PlayerAvailabilitySummary } from "#/server/domain/stats"
import { Badge } from "../ui/badge"
import { formatUsersName } from "../user/utils"
import { InviteFreeAgentModal } from "./invite-free-agent-modal"

type Props = {
	player: PlayerAvailabilitySummary
	type: "free-agent" | "weekly-sub"
	// The team the current user captains this season, if any — the Invite
	// button only shows up for captains, since only they can pick up subs.
	captainTeamId: string | null
}

export function FreeAgentRow({ player, type, captainTeamId }: Props) {
	return (
		<div
			className={css({
				display: "flex",
				flexDirection: "column",
				gap: "2",
				background: "#fff",
				borderColor: "border",
				borderStyle: "solid",
				borderWidth: "1px",
				borderRadius: "2xl",
				py: "3",
				px: "5",
			})}
		>
			<HStack justifyContent={"space-between"} gap="1">
				<VStack alignItems="flex-start" gap="1">
					<Link
						to="/user/$userId"
						params={{ userId: player.userId }}
						className={css({
							fontFamily: "heading",
							fontWeight: "700",
							_hover: { textDecoration: "underline" },
						})}
					>
						{formatUsersName(player)}
					</Link>
					<p
						className={css({
							fontSize: "sm",
							color: "subtitle",
							fontStyle: player.gamesPlayed === 0 ? "italic" : "normal",
						})}
					>
						{player.gamesPlayed === 0
							? "New player, no games logged"
							: `${player.gamesPlayed} ${player.gamesPlayed === 1 ? "game" : "games"} · ${player.topStat?.perGame.toFixed(2)} ${player.topStat?.label}/game`}
					</p>
				</VStack>
				<HStack alignItems="center" gap="3" flexShrink={0}>
					<Badge
						text={
							type === "free-agent"
								? "Looking for a team"
								: "Available this week"
						}
					/>
					{captainTeamId && (
						<button
							type="button"
							onClick={() =>
								openModal(
									<InviteFreeAgentModal
										teamId={captainTeamId}
										player={player}
										type={type}
									/>,
								)
							}
							className={css({
								fontFamily: "heading",
								background: { base: "coral", _hover: "coral.dark" },
								cursor: "pointer",
								fontWeight: "700",
								fontSize: "sm",
								borderRadius: "full",
								color: "sand",
								whiteSpace: "nowrap",
								py: "2",
								px: "4",
							})}
						>
							Invite
						</button>
					)}
				</HStack>
			</HStack>
		</div>
	)
}
