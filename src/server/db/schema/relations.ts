import { defineRelations } from "drizzle-orm"
import { freeAgentAvailability, freeAgentInvites } from "./free-agents"
import { gameLogs } from "./game-logs"
import { gamePlays } from "./game-plays"
import { games } from "./games"
import { leagues } from "./leagues"
import { lineupEntries } from "./lineups"
import { mvpAwards } from "./mvp-awards"
import { seasons } from "./seasons"
import { sessions } from "./sessions"
import { teamJoinRequests } from "./team-join"
import { teamMemberships } from "./team-memberships"
import { teams } from "./teams"
import { users } from "./users"
import { weeks } from "./weeks"

const schema = {
	leagues,
	seasons,
	teams,
	teamMemberships,
	teamJoinRequests,
	users,
	weeks,
	games,
	gameLogs,
	gamePlays,
	mvpAwards,
	freeAgentAvailability,
	freeAgentInvites,
	lineupEntries,
	sessions,
}

export const relations = defineRelations(schema, (r) => ({
	leagues: {
		seasons: r.many.seasons({
			from: r.leagues.id,
			to: r.seasons.leagueId,
		}),
	},
	seasons: {
		league: r.one.leagues({
			from: r.seasons.leagueId,
			to: r.leagues.id,
		}),
		teams: r.many.teams({
			from: r.seasons.id,
			to: r.teams.seasonId,
		}),
		// Named weekRecords, not weeks — seasons already has a "weeks"
		// column (the count of weeks), and drizzle relation names can't
		// collide with column names on the same table.
		weekRecords: r.many.weeks({
			from: r.seasons.id,
			to: r.weeks.seasonId,
		}),
		mvpAward: r.one.mvpAwards({
			from: r.seasons.id,
			to: r.mvpAwards.seasonId,
		}),
	},
	teams: {
		season: r.one.seasons({
			from: r.teams.seasonId,
			to: r.seasons.id,
		}),
		memberships: r.many.teamMemberships({
			from: r.teams.id,
			to: r.teamMemberships.teamId,
		}),
		joinRequests: r.many.teamJoinRequests({
			from: r.teams.id,
			to: r.teamJoinRequests.teamId,
		}),
		freeAgentInvites: r.many.freeAgentInvites({
			from: r.teams.id,
			to: r.freeAgentInvites.teamId,
		}),
		lineupEntries: r.many.lineupEntries({
			from: r.teams.id,
			to: r.lineupEntries.teamId,
		}),
		homeGames: r.many.games({
			from: r.teams.id,
			to: r.games.homeTeamId,
		}),
		awayGames: r.many.games({
			from: r.teams.id,
			to: r.games.awayTeamId,
		}),
	},
	weeks: {
		season: r.one.seasons({
			from: r.weeks.seasonId,
			to: r.seasons.id,
		}),
		games: r.many.games({
			from: r.weeks.id,
			to: r.games.weekId,
		}),
		mvpAwards: r.many.mvpAwards({
			from: r.weeks.id,
			to: r.mvpAwards.weekId,
		}),
		freeAgentAvailability: r.many.freeAgentAvailability({
			from: r.weeks.id,
			to: r.freeAgentAvailability.weekId,
		}),
		temporaryMemberships: r.many.teamMemberships({
			from: r.weeks.id,
			to: r.teamMemberships.weekId,
		}),
	},
	games: {
		week: r.one.weeks({
			from: r.games.weekId,
			to: r.weeks.id,
		}),
		homeTeam: r.one.teams({
			from: r.games.homeTeamId,
			to: r.teams.id,
		}),
		awayTeam: r.one.teams({
			from: r.games.awayTeamId,
			to: r.teams.id,
		}),
		ref: r.one.users({
			from: r.games.refId,
			to: r.users.id,
		}),
		logs: r.many.gameLogs({
			from: r.games.id,
			to: r.gameLogs.gameId,
		}),
		lineupEntries: r.many.lineupEntries({
			from: r.games.id,
			to: r.lineupEntries.gameId,
		}),
		plays: r.many.gamePlays({
			from: r.games.id,
			to: r.gamePlays.gameId,
		}),
	},
	gameLogs: {
		user: r.one.users({
			from: r.gameLogs.userId,
			to: r.users.id,
		}),
		game: r.one.games({
			from: r.gameLogs.gameId,
			to: r.games.id,
		}),
	},
	gamePlays: {
		game: r.one.games({
			from: r.gamePlays.gameId,
			to: r.games.id,
		}),
		batter: r.one.users({
			from: r.gamePlays.batterId,
			to: r.users.id,
		}),
	},
	mvpAwards: {
		week: r.one.weeks({
			from: r.mvpAwards.weekId,
			to: r.weeks.id,
		}),
		season: r.one.seasons({
			from: r.mvpAwards.seasonId,
			to: r.seasons.id,
		}),
		user: r.one.users({
			from: r.mvpAwards.userId,
			to: r.users.id,
		}),
	},
	teamMemberships: {
		team: r.one.teams({
			from: r.teamMemberships.teamId,
			to: r.teams.id,
		}),
		user: r.one.users({
			from: r.teamMemberships.userId,
			to: r.users.id,
		}),
		week: r.one.weeks({
			from: r.teamMemberships.weekId,
			to: r.weeks.id,
		}),
	},
	freeAgentAvailability: {
		user: r.one.users({
			from: r.freeAgentAvailability.userId,
			to: r.users.id,
		}),
		week: r.one.weeks({
			from: r.freeAgentAvailability.weekId,
			to: r.weeks.id,
		}),
		invites: r.many.freeAgentInvites({
			from: r.freeAgentAvailability.id,
			to: r.freeAgentInvites.availabilityId,
		}),
	},
	freeAgentInvites: {
		team: r.one.teams({
			from: r.freeAgentInvites.teamId,
			to: r.teams.id,
		}),
		availability: r.one.freeAgentAvailability({
			from: r.freeAgentInvites.availabilityId,
			to: r.freeAgentAvailability.id,
		}),
	},
	lineupEntries: {
		game: r.one.games({
			from: r.lineupEntries.gameId,
			to: r.games.id,
		}),
		team: r.one.teams({
			from: r.lineupEntries.teamId,
			to: r.teams.id,
		}),
		user: r.one.users({
			from: r.lineupEntries.userId,
			to: r.users.id,
		}),
	},
	teamJoinRequests: {
		team: r.one.teams({
			from: r.teamJoinRequests.teamId,
			to: r.teams.id,
		}),
		player: r.one.users({
			from: r.teamJoinRequests.playerId,
			to: r.users.id,
		}),
	},
	sessions: {
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},
	users: {
		sessions: r.many.sessions({
			from: r.users.id,
			to: r.sessions.userId,
		}),
		teamMemberships: r.many.teamMemberships({
			from: r.users.id,
			to: r.teamMemberships.userId,
		}),
		teamJoinRequests: r.many.teamJoinRequests({
			from: r.users.id,
			to: r.teamJoinRequests.playerId,
		}),
		refereedGames: r.many.games({
			from: r.users.id,
			to: r.games.refId,
		}),
		mvpAwards: r.many.mvpAwards({
			from: r.users.id,
			to: r.mvpAwards.userId,
		}),
		freeAgentAvailability: r.many.freeAgentAvailability({
			from: r.users.id,
			to: r.freeAgentAvailability.userId,
		}),
		lineupEntries: r.many.lineupEntries({
			from: r.users.id,
			to: r.lineupEntries.userId,
		}),
		battedPlays: r.many.gamePlays({
			from: r.users.id,
			to: r.gamePlays.batterId,
		}),
	},
}))
