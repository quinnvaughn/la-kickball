import { DateTime } from "luxon"
import type { gameRoundEnum } from "../db/schema/games"
import type { PlayerTopStat } from "./stats"

export type GameRound = (typeof gameRoundEnum.enumValues)[number]

export type GameStatus = "upcoming" | "in_progress" | "completed" | "suspended"

// Status is never stored — it's derived from suspendedAt/endedAt plus
// whether any play-by-play has been logged yet. homeScore/awayScore are
// kept live by whatever logs a play (see domain/game-plays.ts replayGame),
// so they're trustworthy to read directly for both the live and final
// score — this only decides which *label* applies. Order matters:
// suspended and completed are checked first since a game can accumulate
// plays and still end up suspended (rained out before 4 innings) or,
// ordinarily, completed. A game stopped at 4+ innings never gets
// suspendedAt set at all — it just counts as final on the current score
// (see games.suspendedAt) — so suspended here always means "will be made
// up later," never "this result stands."
export function getGameStatus(game: {
	suspendedAt: Date | null
	endedAt: Date | null
	hasPlays: boolean
}): GameStatus {
	if (game.suspendedAt) return "suspended"
	if (game.endedAt) return "completed"
	if (game.hasPlays) return "in_progress"
	return "upcoming"
}

export interface ScheduleGame {
	id: string
	round: GameRound
	field: string | null
	startTime: string | null
	homeTeamId: string
	homeTeamName: string
	awayTeamId: string
	awayTeamName: string
	homeScore: number | null
	awayScore: number | null
	suspendedAt: Date | null
	status: GameStatus
	// Only meaningful while status is "in_progress" — the half/inning of
	// the most recently logged play. Null once there are no plays yet, or
	// no longer relevant once the game is completed/cancelled.
	half: number | null // 0 = top, 1 = bottom
	inning: number | null
}

// The UI shows every winner as a plain "MVP" card regardless of division —
// the guy/girl/mvp category distinction is still stored in mvp_awards (see
// db/schema/mvp-awards.ts) but isn't surfaced here. atBats/hits drive the
// "4-5" line; topStats mirrors the free-agent/weekly-sub cards (see
// domain/stats.ts PlayerTopStat), just more than one and excluding hits
// (already covered by the "4-5" line) — whichever counting stats this
// player racked up highest that week, not a fixed runs/rki pair. Both are
// empty/zero only if they somehow have an MVP award but no game log for
// that week's games.
export interface WeekMvp {
	userId: string
	firstName: string
	lastName: string
	teamName: string
	atBats: number
	hits: number
	topStats: PlayerTopStat[]
}

export interface ScheduleWeek {
	id: string
	weekNumber: number
	date: string | null
	games: ScheduleGame[]
	mvps: WeekMvp[]
}

export interface Schedule {
	weeks: ScheduleWeek[]
	// The week to default-open and badge as "current" on the schedule tab —
	// purely a display pick, not a signal about whether that week's games
	// are actually done (a suspended game may still owe a makeup long after
	// its week has passed). null once there are no dated weeks at all.
	// Everything else about display order is just weekNumber order; there's
	// no past/future split.
	currentWeekId: string | null
}

// The league plays in LA — week boundaries are LA calendar days regardless
// of what timezone the server process happens to run in (prod runs in UTC).
const LEAGUE_ZONE = "America/Los_Angeles"

// The week whose date falls within the current Sunday-Saturday span — a
// fixed calendar-week lookup, not tied to whichever weekday games are
// actually played on (see currentWeekForSeason in routers/seasons.ts for
// the same Sunday-anchored convention at the DB level, used for "available
// this week" on the Weekly Subs tab). Nothing is "current" once today
// falls outside every dated week's span — before the season starts, in a
// gap between dated weeks, or after the season ends. Game completion has
// no bearing on this pick (a suspended game gets made up some other week,
// not necessarily this one). Undated weeks (schedule not posted yet) are
// never picked.
export function buildSchedule(
	weeks: ScheduleWeek[],
	now = new Date(),
): Schedule {
	const dated = weeks.filter(
		(week): week is ScheduleWeek & { date: string } => week.date !== null,
	)

	const nowDt = DateTime.fromJSDate(now, { zone: LEAGUE_ZONE })
	// Luxon .weekday is ISO: Monday=1 ... Sunday=7. Sunday needs to stay put.
	const startOfWeek = nowDt.startOf("day").minus({ days: nowDt.weekday % 7 })
	const endOfWeek = startOfWeek.plus({ days: 6 }).endOf("day")

	const currentWeek = dated.find((week) => {
		const weekDt = DateTime.fromISO(week.date, { zone: LEAGUE_ZONE })
		return weekDt >= startOfWeek && weekDt <= endOfWeek
	})

	return { weeks, currentWeekId: currentWeek?.id ?? null }
}
