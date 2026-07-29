// A completed regular-season game — just enough to credit a win/loss and
// tally runs. Playoff rounds (quarterfinal/semifinal/final) don't count
// toward standings, so callers should already have filtered to `round:
// "regular"` before this ever sees the rows.
export interface StandingsGame {
	homeTeamId: string
	awayTeamId: string
	homeScore: number
	awayScore: number
}

export interface StandingsTeam {
	teamId: string
	teamName: string
}

// Standard kickball-league points scale: 3 for a win, 1 for a tie, 0 for a
// loss. This is what standings actually rank on — a team that's 5-1 with
// one tie outranks a 5-2 team even though both have 5 wins.
const POINTS_PER_WIN = 3
const POINTS_PER_TIE = 1

export interface TeamStanding {
	teamId: string
	teamName: string
	wins: number
	losses: number
	ties: number
	gamesPlayed: number
	points: number
	runsFor: number
	runsAgainst: number
	runDiff: number
}

// Ranked by points first, then run differential as the tiebreaker — there's
// no head-to-head or strength-of-schedule tiebreak modeled, this is a rec
// league, not a playoff seeding committee.
export function computeStandings(
	teams: StandingsTeam[],
	games: StandingsGame[],
): TeamStanding[] {
	const byTeamId = new Map<string, TeamStanding>(
		teams.map((team) => [
			team.teamId,
			{
				teamId: team.teamId,
				teamName: team.teamName,
				wins: 0,
				losses: 0,
				ties: 0,
				gamesPlayed: 0,
				points: 0,
				runsFor: 0,
				runsAgainst: 0,
				runDiff: 0,
			},
		]),
	)

	for (const game of games) {
		const home = byTeamId.get(game.homeTeamId)
		const away = byTeamId.get(game.awayTeamId)
		if (!home || !away) continue

		home.gamesPlayed++
		away.gamesPlayed++
		home.runsFor += game.homeScore
		home.runsAgainst += game.awayScore
		away.runsFor += game.awayScore
		away.runsAgainst += game.homeScore

		if (game.homeScore > game.awayScore) {
			home.wins++
			away.losses++
		} else if (game.awayScore > game.homeScore) {
			away.wins++
			home.losses++
		} else {
			home.ties++
			away.ties++
		}
	}

	for (const standing of byTeamId.values()) {
		standing.runDiff = standing.runsFor - standing.runsAgainst
		standing.points =
			standing.wins * POINTS_PER_WIN + standing.ties * POINTS_PER_TIE
	}

	return [...byTeamId.values()].sort(
		(a, b) => b.points - a.points || b.runDiff - a.runDiff,
	)
}
