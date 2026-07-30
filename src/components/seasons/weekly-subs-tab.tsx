import { useLoaderData, useRouter } from "@tanstack/react-router"
import { TRPCClientError } from "@trpc/client"
import { useState } from "react"
import { css } from "styled-system/css"
import { Grid, VStack } from "styled-system/jsx"
import { match } from "ts-pattern"
import { openModal } from "#/lib/modal"
import { trpc } from "#/server/client"
import type { WeeklySubs } from "#/server/domain/stats"
import { AuthModal } from "../nav/auth-modal"
import { SectionBlock } from "../ui/section-block"
import { EmptyTabContainer } from "./empty-tab-container"
import { FreeAgentRow } from "./free-agent-row"

type Props = {
	seasonId: string
	weeklySubs: WeeklySubs
	captainTeamId: string | null
}

const availableButtonStyles = css({
	fontFamily: "heading",
	cursor: "pointer",
	fontWeight: "700",
	borderRadius: "full",
	color: "sand",
	background: { base: "coral", _hover: "coral.dark" },
	whiteSpace: "nowrap",
	py: "3",
	px: "6",
	border: "none",
	alignSelf: "flex-start",
})

function MarkAvailableButton({
	seasonId,
	isSignedIn,
}: {
	seasonId: string
	isSignedIn: boolean
}) {
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleClick = async () => {
		if (!isSignedIn) {
			openModal(<AuthModal />)
			return
		}

		setError(null)
		setIsSubmitting(true)
		try {
			await trpc.seasons.markAvailableForWeek.mutate({ seasonId })
			await router.invalidate()
		} catch (err) {
			setError(
				err instanceof TRPCClientError
					? err.message
					: "Something went wrong. Please try again.",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<VStack gap="1" alignItems="flex-start">
			<button
				type="button"
				className={availableButtonStyles}
				onClick={handleClick}
				disabled={isSubmitting}
			>
				Mark yourself available this week
			</button>
			{error && (
				<p className={css({ color: "coral.dark", fontSize: "sm", mt: "1" })}>
					{error}
				</p>
			)}
		</VStack>
	)
}

export function WeeklySubsTab({ seasonId, weeklySubs, captainTeamId }: Props) {
	const user = useLoaderData({ from: "/_layout" })

	// Hidden once the viewer is already covered for the week (rostered,
	// picked up as a sub, or already marked available) — a signed-out
	// visitor is by definition none of those, so they always see it.
	const showMarkAvailableButton =
		weeklySubs.week !== null &&
		(!user ||
			(!weeklySubs.viewerIsOnTeamForWeek &&
				!weeklySubs.viewerHasOpenAvailability))

	return (
		<SectionBlock heading="Weekly Subs">
			<Grid gap="3" width={"100%"}>
				{showMarkAvailableButton && (
					<MarkAvailableButton seasonId={seasonId} isSignedIn={!!user} />
				)}
				{match(weeklySubs.players)
					.when(
						(f) => f.length === 0,
						() => (
							<EmptyTabContainer>
								<p className={css({ color: "subtitle" })}>
									No weekly subs yet.
								</p>
							</EmptyTabContainer>
						),
					)
					.otherwise((freeAgents) =>
						freeAgents.map((fa) => (
							<FreeAgentRow
								player={fa}
								key={fa.userId}
								type="weekly-sub"
								captainTeamId={captainTeamId}
							/>
						)),
					)}
			</Grid>
		</SectionBlock>
	)
}
