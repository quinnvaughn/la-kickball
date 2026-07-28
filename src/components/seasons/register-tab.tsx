import { Link } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { Grid } from "styled-system/jsx"
import type { SeasonWithStatus } from "#/server/domain/seasons"
import { SectionBlock } from "../ui/section-block"

type ROProps = {
	title: string
	body: string
	footer: React.ReactNode
}

function RegisterOption({ title, body, footer }: ROProps) {
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
				p: "6",
			})}
		>
			<h3
				className={css({
					fontFamily: "heading",
					fontWeight: "700",
					fontSize: "md",
					color: "purple.dark",
				})}
			>
				{title}
			</h3>
			<p
				className={css({
					fontSize: "sm",
					color: "subtitle",
					lineHeight: "1.5",
				})}
			>
				{body}
			</p>
			{footer}
		</div>
	)
}

const buttonLinkStyling = css({
	background: "coral",
	color: "sand",
	fontFamily: "heading",
	fontWeight: "700",
	fontSize: "sm",
	py: "3",
	px: "5",
	borderRadius: "full",
	cursor: "pointer",
	textAlign: "center",
})

type Props = {
	playerMinimum: number
	league: string
	season: string
	handleGoToStandings: () => void
}

export function RegisterTab({
	playerMinimum,
	league,
	season,
	handleGoToStandings,
}: Props) {
	return (
		<SectionBlock heading="Register">
			<Grid gap="4" gridTemplateColumns="repeat(3, 1fr)">
				<RegisterOption
					title="Register a team"
					body={`Sign up your team. ${playerMinimum}-player minimum. Share a join code with players after you register.`}
					footer={
						<Link
							to="/leagues/$league/$season/create-team"
							params={{ league, season }}
							className={buttonLinkStyling}
						>
							Register your team
						</Link>
					}
				/>
				<RegisterOption
					title="Sign up as a free agent"
					body={
						"Register without a team. Join one that's open yourself, get invited by a captain, or we'll match you before the season starts."
					}
					footer={
						<Link
							to="/leagues/$league/$season/free-agent"
							params={{ league, season }}
							className={buttonLinkStyling}
						>
							Sign up as a free agent
						</Link>
					}
				/>
				<RegisterOption
					title="Have a team invite?"
					body={
						"Team pages are public, even invite-only ones. Find yours in Standings and use the code a captain gave you to join it."
					}
					footer={
						<button
							className={css({
								fontFamily: "heading",
								fontWeight: "700",
								color: "teal.dark",
								fontSize: "sm",
								cursor: "pointer",
								alignSelf: "flex-start",
							})}
							type="button"
							onClick={handleGoToStandings}
						>
							Go to standings →
						</button>
					}
				/>
			</Grid>
		</SectionBlock>
	)
}
