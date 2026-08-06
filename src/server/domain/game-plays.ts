import type { playOutcomeEnum } from "../db/schema/game-plays"
import type { GameRound } from "./schedule"

type PlayOutcome = (typeof playOutcomeEnum.enumValues)[number]

// A play's runner_events is untyped jsonb — [{ runnerId, fromBase, result }]
// per the game_plays schema comment — describing what happens to runners
// who were already on base when the play started (the batter's own fate
// comes from `outcome` instead). "scored" and "out" are the two result
// values that affect score/outs; anything else (e.g. held at a base) is a
// no-op here.
function runnerEventsCount(runnerEvents: unknown, result: "scored" | "out") {
	if (!Array.isArray(runnerEvents)) return 0
	return runnerEvents.filter(
		(event) =>
			typeof event === "object" &&
			event !== null &&
			(event as { result?: unknown }).result === result,
	).length
}

export interface GamePlaySummary {
	inning: number
	half: number // 0 = top (away batting), 1 = bottom (home batting)
	outcome: PlayOutcome
	runnerEvents: unknown
}

export interface GameProgress {
	homeScore: number
	awayScore: number
	isOver: boolean
}

const REGULATION_INNINGS = 7
const RUNS_PER_HALF_INNING_CAP = 10
const MERCY_RULE_INNING = 4
const MERCY_RULE_DIFFERENTIAL = 15

// Replays a game's plays (already ordered by sequence) into a running score
// and whether the game has reached one of its real end conditions. There's
// no explicit "end game" action from the ref — the play log simply stops
// once the game is actually over — so this has to encode the league's real
// end-of-game rules to tell "over" apart from "just paused between plays":
//
//  - Regulation is 7 innings.
//  - A half-inning can't score more than 10 runs — it ends the moment that
//    cap is hit, regardless of outs.
//  - Mercy rule, live from inning 4 on: if the home team's own lead (while
//    batting) reaches 15+, the game ends immediately, mid at-bat. If the
//    away team is up by 15+ after their half, the home team still gets
//    their full at-bat as a chance to answer; if the gap is still 15+ once
//    that at-bat ends, the game ends there.
//  - Walk-off: in the bottom of the 7th or later, the game ends the moment
//    the home team takes the lead.
//  - If the bottom of the 7th (or a later inning) finishes level, a
//    regular-season game ends as a tie (the league only has so much field
//    time); playoff games continue into extra innings under the same
//    rules until someone's ahead.
//
// Intended to be called from wherever a play gets logged, to decide
// whether to write a final score + games.endedAt — not on every read.
export function replayGame(
	plays: GamePlaySummary[],
	round: GameRound,
): GameProgress {
	let homeScore = 0
	let awayScore = 0
	let inning = 1
	let half = 0
	let outs = 0
	let runsThisHalf = 0

	for (const play of plays) {
		// inning/half are ref-entered ground truth per play, so a change
		// here means a new half-inning has begun — reset the counters that
		// only apply within a single half.
		if (play.inning !== inning || play.half !== half) {
			inning = play.inning
			half = play.half
			outs = 0
			runsThisHalf = 0
		}

		const runs =
			runnerEventsCount(play.runnerEvents, "scored") +
			(play.outcome === "homer" ? 1 : 0)
		const outsOnPlay =
			(play.outcome === "out" || play.outcome === "sac" ? 1 : 0) +
			runnerEventsCount(play.runnerEvents, "out")

		if (half === 0) {
			awayScore += runs
		} else {
			homeScore += runs
		}
		runsThisHalf += runs
		outs += outsOnPlay

		if (
			half === 1 &&
			inning >= MERCY_RULE_INNING &&
			homeScore - awayScore >= MERCY_RULE_DIFFERENTIAL
		) {
			return { homeScore, awayScore, isOver: true }
		}
		if (half === 1 && inning >= REGULATION_INNINGS && homeScore > awayScore) {
			return { homeScore, awayScore, isOver: true }
		}

		const halfComplete = outs >= 3 || runsThisHalf >= RUNS_PER_HALF_INNING_CAP
		if (!halfComplete) continue

		if (half === 0) {
			// Top half just ended — if home is already ahead walking in,
			// there's no reason to play the bottom half.
			if (inning >= REGULATION_INNINGS && homeScore > awayScore) {
				return { homeScore, awayScore, isOver: true }
			}
			continue
		}

		// Bottom half just ended — the inning is fully complete.
		if (
			inning >= MERCY_RULE_INNING &&
			awayScore - homeScore >= MERCY_RULE_DIFFERENTIAL
		) {
			return { homeScore, awayScore, isOver: true }
		}
		if (inning >= REGULATION_INNINGS) {
			if (homeScore !== awayScore || round === "regular") {
				return { homeScore, awayScore, isOver: true }
			}
			// Playoffs, still tied after a complete inning — extra innings.
		}
	}

	return { homeScore, awayScore, isOver: false }
}

export interface GamePlayBatter {
	id: string
	firstName: string
	lastName: string
}

export interface GamePlayRecord extends GamePlaySummary {
	id: string
	sequence: number
	batter: GamePlayBatter
}

export interface GamePlayRunner {
	runnerId: string
	firstName: string
	lastName: string
	result: "scored" | "out" | "held" | "advanced"
	// The base the runner ended up on — only meaningful for "held"/
	// "advanced" (a "scored" or "out" runner isn't sitting on a base
	// anymore), null otherwise.
	toBase: 1 | 2 | 3 | null
}

export interface GamePlayLogEntry {
	id: string
	sequence: number
	outcome: PlayOutcome
	batter: GamePlayBatter
	// Parsed out of the raw runner_events jsonb (see the schema comment on
	// game_plays) and resolved to names — a runner is always someone who
	// batted earlier in this same game, so the running `playersById` map
	// buildPlayLog keeps as it walks the plays oldest-first is enough to
	// resolve every runnerId without a separate roster lookup.
	runners: GamePlayRunner[]
	// Who's on 1st/2nd/3rd after this play — a runner's id, or null for an
	// empty base. Built from runnerEvents' held/advanced/scored/out results
	// plus the batter's own outcome, not just "no entry means unchanged" —
	// see the game_plays schema comment on runner_events.
	bases: [string | null, string | null, string | null]
	// Outs recorded in this half-inning through and including this play —
	// distinct from GameHalfInningLog's own `outs`, which is the half's
	// final count.
	outsInHalf: number
	// Cumulative score for the whole game through this play, not just this
	// half-inning.
	homeScore: number
	awayScore: number
}

export interface GameHalfInningLog {
	half: number
	inning: number
	battingTeamId: string
	battingTeamName: string
	runs: number
	outs: number
	// True only for the single most recent half-inning of a game that's
	// still being played — the caller decides "still being played" (see
	// getGameStatus) since that's a broader question than this function
	// answers on its own.
	isCurrent: boolean
	// Most recent play first — same "most recent first" convention the
	// half-innings themselves are returned in.
	plays: GamePlayLogEntry[]
}

function battersOwnBase(outcome: PlayOutcome): 0 | 1 | 2 | null {
	switch (outcome) {
		case "single":
		case "walk":
			return 0
		case "double":
			return 1
		case "triple":
			return 2
		default:
			return null
	}
}

// Groups a game's plays (oldest first, same convention as replayGame) into
// half-innings, with a running score/out count and the resulting bases
// attached to every play — everything a play-by-play view needs to render
// a play directly, without re-deriving replay math of its own. Returned
// most-recent-first (both the half-innings and the plays within each),
// matching how a game log actually reads.
export function buildPlayLog(
	plays: GamePlayRecord[],
	teams: {
		homeTeamId: string
		homeTeamName: string
		awayTeamId: string
		awayTeamName: string
	},
	isLive: boolean,
): GameHalfInningLog[] {
	const halfInnings: GameHalfInningLog[] = []
	let homeScore = 0
	let awayScore = 0
	let current: GameHalfInningLog | null = null
	const playersById = new Map<string, GamePlayBatter>()

	for (const play of plays) {
		playersById.set(play.batter.id, play.batter)
		if (!current || current.half !== play.half || current.inning !== play.inning) {
			current = {
				half: play.half,
				inning: play.inning,
				battingTeamId: play.half === 0 ? teams.awayTeamId : teams.homeTeamId,
				battingTeamName: play.half === 0 ? teams.awayTeamName : teams.homeTeamName,
				runs: 0,
				outs: 0,
				isCurrent: false,
				plays: [],
			}
			halfInnings.push(current)
		}

		const events = Array.isArray(play.runnerEvents) ? play.runnerEvents : []
		const bases: [string | null, string | null, string | null] = [null, null, null]
		const runners: GamePlayRunner[] = []
		for (const event of events) {
			if (typeof event !== "object" || event === null) continue
			const { runnerId, result, toBase } = event as {
				runnerId?: unknown
				result?: unknown
				toBase?: unknown
			}
			if (
				(result === "held" || result === "advanced") &&
				typeof runnerId === "string" &&
				(toBase === 1 || toBase === 2 || toBase === 3)
			) {
				bases[toBase - 1] = runnerId
			}
			if (
				typeof runnerId === "string" &&
				(result === "scored" ||
					result === "out" ||
					result === "held" ||
					result === "advanced")
			) {
				const runner = playersById.get(runnerId)
				if (runner) {
					runners.push({
						runnerId,
						firstName: runner.firstName,
						lastName: runner.lastName,
						result,
						toBase: toBase === 1 || toBase === 2 || toBase === 3 ? toBase : null,
					})
				}
			}
		}
		const batterBase = battersOwnBase(play.outcome)
		if (batterBase !== null) bases[batterBase] = play.batter.id

		const runsOnPlay =
			runnerEventsCount(play.runnerEvents, "scored") + (play.outcome === "homer" ? 1 : 0)
		const outsOnPlay =
			(play.outcome === "out" || play.outcome === "sac" ? 1 : 0) +
			runnerEventsCount(play.runnerEvents, "out")

		if (play.half === 0) {
			awayScore += runsOnPlay
		} else {
			homeScore += runsOnPlay
		}
		current.runs += runsOnPlay
		current.outs += outsOnPlay

		current.plays.push({
			id: play.id,
			sequence: play.sequence,
			outcome: play.outcome,
			batter: play.batter,
			runners,
			bases,
			outsInHalf: current.outs,
			homeScore,
			awayScore,
		})
	}

	const lastHalfInning = halfInnings.at(-1)
	if (isLive && lastHalfInning) {
		lastHalfInning.isCurrent = true
	}

	for (const group of halfInnings) {
		group.plays.reverse()
	}
	return halfInnings.reverse()
}
