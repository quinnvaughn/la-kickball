const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" })
const ordinalSuffixes: Record<Intl.LDMLPluralRule, string> = {
	one: "st",
	two: "nd",
	few: "rd",
	other: "th",
	zero: "th",
	many: "th",
}

function formatInning(inning: number) {
	return `${inning}${ordinalSuffixes[ordinalRules.select(inning)]}`
}

export function formatHalfInning(game: {
	half: number | null
	inning: number | null
}) {
	if (game.half === null || game.inning === null) return null
	return `${game.half === 0 ? "Top" : "Bottom"} ${formatInning(game.inning)}`
}
