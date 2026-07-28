import { HStack } from "styled-system/jsx"
import { closeModal } from "#/lib/modal"
import type { PlayerAvailabilitySummary } from "#/server/domain/stats"
import { Modal } from "../ui/modal"
import { Textbox } from "../ui/textbox"
import { formatUsersName } from "../user/utils"

type Props = {
	teamId: string
	player: PlayerAvailabilitySummary
	// "free-agent" offers a season-long roster spot; "weekly-sub" offers a
	// one-off pickup for a single week. Same shape today — they'll diverge
	// once this is wired to a real mutation, since a weekly-sub invite also
	// needs to know which week.
	type: "free-agent" | "weekly-sub"
}

export function InviteFreeAgentModal({ player, type }: Props) {
	const offer =
		type === "free-agent"
			? "join your team for this season."
			: "sub for this week's game."

	return (
		<Modal open onClose={closeModal}>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					closeModal()
				}}
			>
				<Modal.Header>
					<Modal.Title>Send invite</Modal.Title>
					<Modal.Subtitle>
						Invite {formatUsersName(player)} to {offer}
					</Modal.Subtitle>
				</Modal.Header>
				<Modal.Body>
					<Textbox placeholder="Add a note...">
						<Textbox.Label>Message (optional)</Textbox.Label>
						<Textbox.Textarea rows={4} />
					</Textbox>
				</Modal.Body>
				<Modal.Footer>
					<HStack>
						<Modal.CancelButton onClick={closeModal}>Cancel</Modal.CancelButton>
						<Modal.SubmitButton>Send invite</Modal.SubmitButton>
					</HStack>
				</Modal.Footer>
			</form>
		</Modal>
	)
}
