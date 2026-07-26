import { css, cx } from "styled-system/css"
import { Grid, VStack } from "styled-system/jsx"
import { PRICING } from "#/server/domain/pricing"
import {
	getPricingTier,
	getPricingTierDateLabels,
	hasPlayoffsEnded,
	type PricingTier,
} from "./utils"

type Props = {
	startDate: string | null
	weeks: number
}

const TIERS: { key: PricingTier; label: string; cents: number }[] = [
	{ key: "early", label: "Early Bird", cents: PRICING.earlyBirdCents },
	{ key: "normal", label: "Normal", cents: PRICING.normalCents },
	{ key: "late", label: "Late", cents: PRICING.lateCents },
]

function formatPrice(cents: number) {
	return `$${(cents / 100).toFixed(0)}`
}

const tierCardStyles = css({
	flex: "1",
	minWidth: "120px",
	borderRadius: "xl",
	borderStyle: "solid",
	borderWidth: "1px",
	borderColor: "border",
	py: "3",
	px: "4",
})

const tierCardActiveStyles = css({
	borderColor: "gold",
	background: "rgba(255,182,39,0.08)",
})

export function RegistrationPricing({ startDate, weeks }: Props) {
	if (startDate && hasPlayoffsEnded(startDate, weeks)) return null

	const currentTier = startDate ? getPricingTier(startDate) : null
	const dateLabels = startDate ? getPricingTierDateLabels(startDate) : null

	return (
		<div
			className={css({
				display: "flex",
				flexDirection: "column",
				gap: "3",
				background: "#fff",
				borderColor: "border",
				borderStyle: "solid",
				borderWidth: "1px",
				borderRadius: "2xl",
				py: "4",
				px: "5",
				fontSize: "sm",
				color: "subtitle",
				width: "100%",
			})}
		>
			<div
				className={css({
					fontFamily: "heading",
					fontWeight: "700",
					fontSize: "md",
					color: "ink",
				})}
			>
				Registration Pricing
			</div>
			<Grid gridTemplateColumns={"repeat(3, 1fr)"} gap="3" width="100%">
				{TIERS.map((tier) => (
					<VStack
						key={tier.key}
						gap="1"
						alignItems="center"
						className={cx(
							tierCardStyles,
							tier.key === currentTier && tierCardActiveStyles,
						)}
					>
						<div
							className={css({
								fontFamily: "label",
								fontSize: "xs",
								textTransform: "uppercase",
								letterSpacing: "wider",
								fontWeight: tier.key === currentTier ? "700" : "400",
								color: tier.key === currentTier ? "gold.dark" : "subtitle",
							})}
						>
							{tier.label}
						</div>
						<div
							className={css({
								fontFamily: "heading",
								fontWeight: "700",
								fontSize: "lg",
								color: "ink",
							})}
						>
							{formatPrice(tier.cents)}
						</div>
						{dateLabels && (
							<div
								className={css({
									fontSize: "xs",
									color: "subtitle",
								})}
							>
								{dateLabels[tier.key]}
							</div>
						)}
					</VStack>
				))}
			</Grid>
		</div>
	)
}
