import { useRouter } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { css } from "styled-system/css"
import { HStack } from "styled-system/jsx"
import z from "zod"
import { useForm } from "#/lib/form"
import { closeModal } from "#/lib/modal"
import { trpc } from "#/server/client"
import type { FreeAgentListing } from "#/server/domain/stats"
import { Modal } from "../ui/modal"
import { Textbox } from "../ui/textbox"
import { formatUsersName } from "../user/utils"

type Props = {
	teamId: string
	player: FreeAgentListing
	// "free-agent" offers a season-long roster spot; "weekly-sub" offers a
	// one-off pickup for a single week. Both send the same
	// freeAgentInvites row today — they only differ in the copy shown
	// here, since the acceptance flow that would tell them apart doesn't
	// exist yet.
	type: "free-agent" | "weekly-sub"
}

export function InviteFreeAgentModal({ teamId, player, type }: Props) {
	const router = useRouter()

	const offer =
		type === "free-agent"
			? "join your team for this season."
			: "sub for this week's game."

	const form = useForm({
		schema: z.object({
			message: z.string().max(500, "Keep it under 500 characters.").optional(),
		}),
		defaultValues: {
			message: "",
		},
		onSubmit: async (values, helpers) => {
			try {
				await trpc.seasons.sendFreeAgentInvite.mutate({
					teamId,
					availabilityId: player.availabilityId,
					message: values.message || undefined,
				})

				await router.invalidate()
				closeModal()
			} catch (err) {
				const message =
					err instanceof TRPCClientError
						? err.message
						: "Something went wrong. Please try again."
				helpers.setFormError(message)
			}
		},
	})

	return (
		<Modal open onClose={closeModal}>
			<form onSubmit={form.handleSubmit}>
				<Modal.Header>
					<Modal.Title>Send invite</Modal.Title>
					<Modal.Subtitle>
						Invite {formatUsersName(player)} to {offer}
					</Modal.Subtitle>
				</Modal.Header>
				<Modal.Body>
					<form.Field name="message">
						{(field) => (
							<Textbox
								{...field}
								error={field.meta.error}
								placeholder="Add a note..."
							>
								<Textbox.Label>Message (optional)</Textbox.Label>
								<Textbox.Textarea rows={4} />
								<Textbox.Error />
							</Textbox>
						)}
					</form.Field>
				</Modal.Body>
				<Modal.Footer>
					<form.Subscribe selector={(s) => s.meta.formError}>
						{(formError) =>
							formError && (
								<p className={css({ color: "coral.dark" })}>{formError}</p>
							)
						}
					</form.Subscribe>
					<HStack>
						<Modal.CancelButton onClick={closeModal}>Cancel</Modal.CancelButton>
						<form.Subscribe
							selector={(s) => [s.meta.canSubmit, s.meta.isSubmitting] as const}
						>
							{([canSubmit, isSubmitting]) => (
								<Modal.SubmitButton disabled={!canSubmit || isSubmitting}>
									Send invite
								</Modal.SubmitButton>
							)}
						</form.Subscribe>
					</HStack>
				</Modal.Footer>
			</form>
		</Modal>
	)
}
