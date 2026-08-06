import { match } from "ts-pattern"
import { formatUsersName } from "../user/utils"
import type { HalfInning } from "./game-logs-tab"

type Play = HalfInning["plays"][number]

const baseNames: Record<1 | 2 | 3, string> = {
	1: "first",
	2: "second",
	3: "third",
}

function joinNames(names: string[]) {
	if (names.length <= 1) return names[0] ?? ""
	if (names.length === 2) return `${names[0]} and ${names[1]}`
	return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

export function formatPlay(play: Play) {
	const batterName = formatUsersName(play.batter)
	const sentences = [
		match(play.outcome)
			.with("single", () => `${batterName} singles.`)
			.with("double", () => `${batterName} doubles.`)
			.with("triple", () => `${batterName} triples.`)
			.with("homer", () => `${batterName} homers.`)
			.with("walk", () => `${batterName} walks.`)
			.with("sac", () => `${batterName} sacrifices.`)
			.with("out", () => `${batterName} is out.`)
			.exhaustive(),
	]

	const advancedByBase = new Map<1 | 2 | 3, string[]>()
	for (const runner of play.runners) {
		if (runner.result !== "advanced" || runner.toBase === null) continue
		const names = advancedByBase.get(runner.toBase) ?? []
		names.push(formatUsersName(runner))
		advancedByBase.set(runner.toBase, names)
	}
	for (const toBase of [1, 2, 3] as const) {
		const names = advancedByBase.get(toBase)
		if (!names || names.length === 0) continue
		sentences.push(
			`${joinNames(names)} ${names.length === 1 ? "advances" : "advance"} to ${baseNames[toBase]}.`,
		)
	}

	const scored = play.runners
		.filter((runner) => runner.result === "scored")
		.map((runner) => formatUsersName(runner))
	if (scored.length > 0) {
		sentences.push(`${joinNames(scored)} ${scored.length === 1 ? "scores" : "score"}.`)
	}

	const out = play.runners
		.filter((runner) => runner.result === "out")
		.map((runner) => formatUsersName(runner))
	if (out.length > 0) {
		sentences.push(`${joinNames(out)} ${out.length === 1 ? "is" : "are"} out.`)
	}

	return sentences.join(" ")
}
