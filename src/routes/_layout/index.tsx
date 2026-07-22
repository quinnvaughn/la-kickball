import { createFileRoute } from "@tanstack/react-router"
import { css } from "styled-system/css"
import { BenefitItem } from "#/components/landing-page/benefit-item"
import { FAQItem } from "#/components/landing-page/faq-item"
import { Hero } from "#/components/landing-page/hero"
import { LeagueCard } from "#/components/landing-page/league-card"
import { LPSection } from "#/components/landing-page/lp-section"
import { StepItem } from "#/components/landing-page/step-item"
import { trpc } from "../../server/client"

export const Route = createFileRoute("/_layout/")({
	loader: async () => {
		return trpc.leagues.list.query()
	},
	component: Home,
})

function Home() {
	const leagues = Route.useLoaderData()

	return (
		<div>
			<Hero />
			<div
				className={css({
					maxW: "5xl",
					mx: "auto",
					px: "8",
				})}
			>
				<LPSection heading="Leagues">
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
							gap: "4",
						})}
					>
						{leagues.map((league) => (
							<LeagueCard
								key={league.id}
								slug={league.slug}
								name={league.name}
							/>
						))}
					</div>
				</LPSection>
				<LPSection heading="What you get">
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "repeat(2, 1fr)",
							gap: "4",
						})}
					>
						<BenefitItem
							heading="A profile that tracks your stats"
							text="Your stats carry across seasons, tied to your own profile, not locked inside one team's spreadsheet."
						/>
						<BenefitItem
							heading="Ref-logged box scores"
							text="A ref records the game, so the score and stats come from the same source every time."
						/>
						<BenefitItem
							heading="Free agent options"
							text="Join a team that's open to free agents for the full season. Teams can also request a sub for a single week when they're short players, with priority always going to full-season players."
						/>
						<BenefitItem
							heading="One set of rules"
							text="The same rules apply across every league, not whatever a given field or captain decides that day."
						/>
					</div>
				</LPSection>
				<LPSection heading="How it works">
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "repeat(4, 1fr)",
							gap: "4",
						})}
					>
						<StepItem
							number={1}
							heading="Sign up"
							text="Register a team, or join one that's open to free agents for the season."
						/>
						<StepItem
							number={2}
							heading="Get your schedule"
							text="See your games, opponents, and field assignments."
						/>
						<StepItem
							number={3}
							heading="Play"
							text="A ref runs the game and logs the box score."
						/>
						<StepItem
							number={4}
							heading="Check your stats"
							text="Game-by-game stats show up on your profile automatically."
						/>
					</div>
				</LPSection>
				<LPSection heading="FAQ" stretch>
					<div
						className={css({
							display: "grid",
							gridTemplateColumns: "1fr",
							gap: "4",
						})}
					>
						<FAQItem
							question="Do I need experience to play?"
							answer="No experience required, but plenty of competitive players join too. Right now there's one skill level across the league; separate competitive divisions may come later as it grows."
						/>
						<FAQItem
							question="What do I need to bring?"
							answer="Closed-toe shoes and water. Nothing else is required."
						/>
						<FAQItem
							question="What happens if it rains?"
							answer="Cancellations are posted before game time. Check the schedule page for the current status of your game."
						/>
						<FAQItem
							question="Can I get a refund if I can't finish the season?"
							answer="Reach out before the season starts and we'll work it out. Refund terms after the season begins depend on how many games have already been played."
						/>
						<FAQItem
							question="How do free agents work?"
							answer="Sign up as a free agent anytime, whether or not you're waiting on a captain to form a team. Join a team directly if it's open, or request to join one that isn't, captains can also invite you. Anyone left unplaced gets sorted the day before the season starts, including onto a free agent team if there are enough people. If you're not placed, you're refunded. Once the season is underway, teams can also pull in a single-week sub if they're short players that week; you only pay if you actually play, and full-season players get priority."
						/>
					</div>
				</LPSection>
			</div>
		</div>
	)
}
