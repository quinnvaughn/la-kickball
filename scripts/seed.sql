-- Fake dev data for the Cheviot Hills league, so frontend work (team
-- pages, schedules, box scores, career leaders, MVP awards, open-team
-- signups, free agents) has something real to render against.
--
-- Fully self-contained: creates the "cheviot-hills" league and its five
-- seasons itself, with every date computed relative to CURRENT_DATE, so
-- the seasons are always in the right lifecycle stage no matter when this
-- is run. The five seasons cover:
--   - future:    registration open, starts ~2.5 months out
--   - soon:      registration open, starts within the next two weeks
--   - active:    regular season in progress (partway through its weeks)
--   - playoffs:  regular season done, semifinals played, final scheduled
--                but not yet played
--   - completed: entire season finished, final played, winner recorded
--
-- Destructive by design: this deletes any existing "cheviot-hills" league
-- (which cascades away its seasons/teams/weeks/games/stats) and any
-- previously seeded fake users before reseeding, so it's safe to re-run
-- any time and always reflects "today".
--
-- Run with: pnpm db:seed

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.season_quarter_label(p_date date)
RETURNS season_name LANGUAGE sql AS $fn$
	SELECT (ARRAY['winter','spring','summer','fall']::season_name[])[
		((EXTRACT(MONTH FROM p_date)::int - 1) / 3) + 1
	];
$fn$;

-- The date matching p_weekday within the same Sunday-Saturday span as
-- p_ref_date, regardless of which weekday p_ref_date itself falls on. Same
-- Sunday-anchoring trick as currentWeekForSeason (routers/seasons.ts) and
-- buildSchedule (domain/schedule.ts): date_trunc('week', ...) truncates to
-- Monday, so shifting the input forward a day before truncating (and back
-- a day after) turns that into the Sunday that starts p_ref_date's week.
CREATE OR REPLACE FUNCTION pg_temp.week_anchor(p_ref_date date, p_weekday text)
RETURNS date LANGUAGE sql AS $fn$
	SELECT (date_trunc('week', p_ref_date + 1) - interval '1 day')::date
		+ (CASE lower(p_weekday)
			WHEN 'sunday' THEN 0
			WHEN 'monday' THEN 1
			WHEN 'tuesday' THEN 2
			WHEN 'wednesday' THEN 3
			WHEN 'thursday' THEN 4
			WHEN 'friday' THEN 5
			WHEN 'saturday' THEN 6
		END);
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.seed_game_logs(p_game_id uuid, p_roster uuid[])
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
	uid uuid;
	ab int;
	hit_singles int;
	hit_doubles int;
	hit_triples int;
	hit_homers int;
	hit_walks int;
	hit_sacs int;
	hit_runs int;
	hit_rki int;
	hit_xbt int;
	k int;
	r float;
BEGIN
	FOREACH uid IN ARRAY p_roster LOOP
		ab := 2 + floor(random() * 3)::int; -- 2..4
		hit_singles := 0;
		hit_doubles := 0;
		hit_triples := 0;
		hit_homers := 0;

		FOR k IN 1..ab LOOP
			r := random();
			IF r < 0.45 THEN
				NULL; -- out
			ELSIF r < 0.70 THEN
				hit_singles := hit_singles + 1;
			ELSIF r < 0.85 THEN
				hit_doubles := hit_doubles + 1;
			ELSIF r < 0.90 THEN
				hit_triples := hit_triples + 1;
			ELSIF r < 0.97 THEN
				hit_homers := hit_homers + 1;
			END IF;
		END LOOP;

		hit_walks := floor(random() * 2)::int; -- 0..1
		hit_sacs := CASE WHEN random() < 0.15 THEN 1 ELSE 0 END;
		hit_runs := floor(random() * 3)::int; -- 0..2
		hit_rki := floor(random() * 4)::int; -- 0..3
		hit_xbt := floor(random() * 3)::int; -- 0..2

		INSERT INTO game_logs (
			id, game_id, user_id, at_bats, runs, rki,
			singles, doubles, triples, homers, walks, sacs, extra_bases_taken
		) VALUES (
			gen_random_uuid(), p_game_id, uid, ab, hit_runs, hit_rki,
			hit_singles, hit_doubles, hit_triples, hit_homers, hit_walks, hit_sacs, hit_xbt
		);
	END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.seed_season(
	p_season_id uuid,
	p_team_count int,
	p_roster_size int,
	p_total_weeks int,
	p_completed_weeks int,
	p_add_playoffs boolean, -- true = regular season done, semis played, final scheduled but not yet played
	p_final_played boolean, -- true = final has also been played and the season winner recorded
	p_post_next_week boolean, -- true = the week right after p_completed_weeks gets matchups posted (no scores/logs yet)
	p_suspend_first_game boolean, -- true = week 1's first game is suspended (rained out early) instead of completed
	p_team_names text[],
	p_player_pool uuid[],
	p_ref_pool uuid[]
) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
	v_season record;
	team_ids uuid[] := '{}';
	team_id uuid;
	shuffled_players uuid[];
	week_id uuid;
	-- Separate from week_id: a bare "week_id" inside the MVP loop's SQL
	-- below is ambiguous against the games.week_id column and errors, so
	-- that query needs its own, differently-named variable to bind against.
	mvp_week_id uuid;
	week_date date;
	t int;
	w int;
	g int;
	home_idx int;
	away_idx int;
	home_team uuid;
	away_team uuid;
	game_id uuid;
	home_score int;
	away_score int;
	ref_id uuid;
	pairing_sets int[][] := ARRAY[ARRAY[1,2,3,4], ARRAY[1,3,2,4], ARRAY[1,4,2,3]];
	-- Standard 6-team round-robin (circle method): 5 rounds, 3 pairs each,
	-- every team plays every other team exactly once across the 5 rounds.
	pairing_sets_6 int[][] := ARRAY[
		ARRAY[1,6,2,5,3,4],
		ARRAY[1,5,6,4,2,3],
		ARRAY[1,4,5,3,6,2],
		ARRAY[1,3,4,2,5,6],
		ARRAY[1,2,3,6,4,5]
	];
	active_pairing_sets int[][];
	round_count int;
	num_games int;
	home_roster uuid[];
	away_roster uuid[];
	p1_batter uuid;
	set_idx int;
	semi1_winner uuid;
	semi2_winner uuid;
	semi1_winner_idx int;
	semi2_winner_idx int;
	semi1_id uuid;
	semi2_id uuid;
	final_id uuid;
	final_winner uuid;
	mvp_candidate uuid;
BEGIN
	SELECT * INTO v_season FROM seasons WHERE id = p_season_id;

	IF p_team_count = 6 THEN
		active_pairing_sets := pairing_sets_6;
		round_count := 5;
	ELSE
		active_pairing_sets := pairing_sets;
		round_count := 3;
	END IF;
	num_games := p_team_count / 2;

	FOR t IN 1..p_team_count LOOP
		team_id := gen_random_uuid();
		INSERT INTO teams (id, name, season_id, is_open, invite_code)
		VALUES (team_id, p_team_names[t], p_season_id, false, NULL);
		team_ids := array_append(team_ids, team_id);
	END LOOP;

	-- One shuffle of the pool, sliced roster_size-at-a-time per team —
	-- no player is double-booked onto two teams in the same season.
	shuffled_players := ARRAY(SELECT unnest(p_player_pool) ORDER BY random());

	FOR t IN 1..p_team_count LOOP
		FOR g IN 1..p_roster_size LOOP
			INSERT INTO team_memberships (id, team_id, user_id, is_captain, week_id, joined_at)
			VALUES (
				gen_random_uuid(),
				team_ids[t],
				shuffled_players[(t - 1) * p_roster_size + g],
				g = 1,
				NULL,
				COALESCE(v_season.start_date::timestamp, now()) - interval '30 days'
			);
		END LOOP;
	END LOOP;

	FOR w IN 1..p_total_weeks LOOP
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + ((w - 1) * 7);
		INSERT INTO weeks (id, season_id, week_number, date) VALUES (week_id, p_season_id, w, week_date);

		IF w <= p_completed_weeks THEN
			set_idx := ((w - 1) % round_count) + 1;

			FOR g IN 1..num_games LOOP
				home_idx := active_pairing_sets[set_idx][(g - 1) * 2 + 1];
				away_idx := active_pairing_sets[set_idx][(g - 1) * 2 + 2];

				home_team := team_ids[home_idx];
				away_team := team_ids[away_idx];
				ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];

				game_id := gen_random_uuid();

				IF p_suspend_first_game AND w = 1 AND g = 1 THEN
					-- Suspended: called off (rain) partway through the 2nd
					-- inning, well under the 4-inning threshold, so this
					-- score doesn't count and the game owes a full replay —
					-- no ended_at, no box score. Lineups + a handful of
					-- plays are still seeded (mirroring the in-progress
					-- game below) so half/inning are derivable the same
					-- way a live game's are, for the schedule tab.
					home_roster := shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)];
					away_roster := shuffled_players[((away_idx - 1) * p_roster_size + 1):(away_idx * p_roster_size)];

					INSERT INTO games (
						id, week_id, home_team_id, away_team_id, round, field,
						start_time, home_score, away_score, suspended_at, ref_id
					) VALUES (
						game_id, week_id, home_team, away_team, 'regular',
						'Field ' || g,
						v_season.start_time, 2, 1,
						(week_date + v_season.start_time) + interval '35 minutes', ref_id
					);

					FOR t IN 1..p_roster_size LOOP
						INSERT INTO lineup_entries (id, game_id, team_id, user_id, batting_order)
						VALUES (gen_random_uuid(), game_id, home_team, home_roster[t], t);
						INSERT INTO lineup_entries (id, game_id, team_id, user_id, batting_order)
						VALUES (gen_random_uuid(), game_id, away_team, away_roster[t], t);
					END LOOP;

					-- Top 1: away leads off with a single, then a single
					-- scores her (1-0 away).
					p1_batter := away_roster[1];
					INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
					VALUES (gen_random_uuid(), game_id, 1, p1_batter, 'single', 0, 1, '[]');
					INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
					VALUES (
						gen_random_uuid(), game_id, 2, away_roster[2], 'single', 0, 1,
						jsonb_build_array(jsonb_build_object('runnerId', p1_batter, 'fromBase', 1, 'result', 'scored'))
					);

					-- Bottom 1: home answers with back-to-back homers (2-1 home).
					INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
					VALUES (gen_random_uuid(), game_id, 3, home_roster[1], 'homer', 1, 1, '[]');
					INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
					VALUES (gen_random_uuid(), game_id, 4, home_roster[2], 'homer', 1, 1, '[]');

					-- Top 2: one out, then the rain stops play.
					INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
					VALUES (gen_random_uuid(), game_id, 5, away_roster[3], 'out', 0, 2, '[]');
				ELSE
					LOOP
						home_score := 3 + floor(random() * 13)::int;
						away_score := 3 + floor(random() * 13)::int;
						EXIT WHEN home_score <> away_score;
					END LOOP;

					INSERT INTO games (
						id, week_id, home_team_id, away_team_id, round, field,
						start_time, home_score, away_score, ended_at, ref_id
					) VALUES (
						game_id, week_id, home_team, away_team, 'regular',
						'Field ' || g,
						v_season.start_time, home_score, away_score,
						(week_date + v_season.start_time) + interval '2 hours', ref_id
					);

					PERFORM pg_temp.seed_game_logs(
						game_id,
						shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)]
					);
					PERFORM pg_temp.seed_game_logs(
						game_id,
						shuffled_players[((away_idx - 1) * p_roster_size + 1):(away_idx * p_roster_size)]
					);
				END IF;
			END LOOP;
		ELSIF p_post_next_week AND w = p_completed_weeks + 1 THEN
			-- This week mixes three game states so the schedule tab (and
			-- ref tooling) has one of each to exercise: a game that hasn't
			-- started, one that's finished, and one that's mid-play with a
			-- couple of logged plays and lineups set. Assumes 6 teams
			-- (three games) — this branch is only ever reached by the
			-- active season, which is seeded with p_team_count = 6.
			set_idx := ((w - 1) % round_count) + 1;

			-- Game 1: upcoming — matchup posted, nothing played yet.
			home_idx := active_pairing_sets[set_idx][1];
			away_idx := active_pairing_sets[set_idx][2];
			ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];

			INSERT INTO games (
				id, week_id, home_team_id, away_team_id, round, field, start_time, ref_id
			) VALUES (
				gen_random_uuid(), week_id, team_ids[home_idx], team_ids[away_idx], 'regular',
				'Field 1', v_season.start_time, ref_id
			);

			-- Game 2: completed — final score, box score stats, ended_at set.
			home_idx := active_pairing_sets[set_idx][3];
			away_idx := active_pairing_sets[set_idx][4];
			ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];

			LOOP
				home_score := 3 + floor(random() * 13)::int;
				away_score := 3 + floor(random() * 13)::int;
				EXIT WHEN home_score <> away_score;
			END LOOP;

			game_id := gen_random_uuid();
			INSERT INTO games (
				id, week_id, home_team_id, away_team_id, round, field,
				start_time, home_score, away_score, ended_at, ref_id
			) VALUES (
				game_id, week_id, team_ids[home_idx], team_ids[away_idx], 'regular',
				'Field 2', v_season.start_time, home_score, away_score,
				(week_date + v_season.start_time) + interval '2 hours', ref_id
			);

			PERFORM pg_temp.seed_game_logs(
				game_id,
				shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)]
			);
			PERFORM pg_temp.seed_game_logs(
				game_id,
				shuffled_players[((away_idx - 1) * p_roster_size + 1):(away_idx * p_roster_size)]
			);

			-- Game 3: in progress — lineups set, a couple of plays logged,
			-- no final score yet. homeScore/awayScore reflect exactly what
			-- those two plays produced, same as the live-scoring model
			-- (games.homeScore/awayScore are kept in sync as plays land,
			-- not typed in after the fact).
			home_idx := active_pairing_sets[set_idx][5];
			away_idx := active_pairing_sets[set_idx][6];
			ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
			home_roster := shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)];
			away_roster := shuffled_players[((away_idx - 1) * p_roster_size + 1):(away_idx * p_roster_size)];

			game_id := gen_random_uuid();
			INSERT INTO games (
				id, week_id, home_team_id, away_team_id, round, field,
				start_time, home_score, away_score, ref_id
			) VALUES (
				game_id, week_id, team_ids[home_idx], team_ids[away_idx], 'regular',
				'Field 3', v_season.start_time, 0, 1, ref_id
			);

			FOR t IN 1..p_roster_size LOOP
				INSERT INTO lineup_entries (id, game_id, team_id, user_id, batting_order)
				VALUES (gen_random_uuid(), game_id, team_ids[home_idx], home_roster[t], t);
				INSERT INTO lineup_entries (id, game_id, team_id, user_id, batting_order)
				VALUES (gen_random_uuid(), game_id, team_ids[away_idx], away_roster[t], t);
			END LOOP;

			-- Away leads off, singles; next batter doubles her in.
			p1_batter := away_roster[1];
			INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
			VALUES (gen_random_uuid(), game_id, 1, p1_batter, 'single', 0, 1, '[]');

			INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
			VALUES (
				gen_random_uuid(), game_id, 2, away_roster[2], 'double', 0, 1,
				jsonb_build_array(jsonb_build_object('runnerId', p1_batter, 'fromBase', 1, 'result', 'scored'))
			);
		END IF;
	END LOOP;

	-- Weekly MVPs for every regular-season week that's actually happened,
	-- independent of whether the season has playoffs yet. Coed weeks get
	-- two winners (guy/girl); mens weeks get a single winner, since that
	-- division has no gender split to make and doesn't track defense.
	-- Candidates are drawn straight from that week's game_logs rather than
	-- shuffled_players — shuffled_players is the whole shared player pool
	-- (only a prefix of it lands on a roster this season) and, separately,
	-- a suspended game (see p_suspend_first_game) never gets game_logs
	-- seeded at all. Querying game_logs directly guarantees every MVP
	-- actually has a stat line to show for that week, in one fix.
	FOR w IN 1..p_completed_weeks LOOP
		SELECT id INTO week_id FROM weeks WHERE season_id = p_season_id AND week_number = w;
		mvp_week_id := week_id;

		IF v_season.division = 'coed' THEN
			SELECT gl.user_id INTO mvp_candidate
			FROM game_logs gl JOIN games g ON g.id = gl.game_id
			WHERE g.week_id = mvp_week_id ORDER BY random() LIMIT 1;
			INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
			VALUES (gen_random_uuid(), week_id, NULL, 'guy', mvp_candidate);

			SELECT gl.user_id INTO mvp_candidate
			FROM game_logs gl JOIN games g ON g.id = gl.game_id
			WHERE g.week_id = mvp_week_id ORDER BY random() LIMIT 1;
			INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
			VALUES (gen_random_uuid(), week_id, NULL, 'girl', mvp_candidate);
		ELSE
			SELECT gl.user_id INTO mvp_candidate
			FROM game_logs gl JOIN games g ON g.id = gl.game_id
			WHERE g.week_id = mvp_week_id ORDER BY random() LIMIT 1;
			INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
			VALUES (gen_random_uuid(), week_id, NULL, 'mvp', mvp_candidate);
		END IF;
	END LOOP;

	-- The season's overall regular-season MVP, awarded once the whole
	-- regular season (not just some prefix of it) has been played — a
	-- season still mid-way through shouldn't have "the" regular-season
	-- winner decided yet. Drawn from regular-round game_logs across the
	-- whole season, same reasoning as the weekly-MVP candidate query above.
	IF p_completed_weeks >= p_total_weeks THEN
		SELECT gl.user_id INTO mvp_candidate
		FROM game_logs gl
		JOIN games g ON g.id = gl.game_id
		JOIN weeks wk ON wk.id = g.week_id
		WHERE wk.season_id = p_season_id AND g.round = 'regular'
		ORDER BY random() LIMIT 1;

		INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
		VALUES (gen_random_uuid(), NULL, p_season_id, 'regular', mvp_candidate);
	END IF;

	IF p_add_playoffs THEN
		-- Semifinals: teams[1] v teams[2], teams[3] v teams[4] — already played.
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + (p_total_weeks * 7);
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (week_id, p_season_id, p_total_weeks + 1, week_date);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		LOOP
			home_score := 3 + floor(random() * 13)::int;
			away_score := 3 + floor(random() * 13)::int;
			EXIT WHEN home_score <> away_score;
		END LOOP;
		semi1_id := gen_random_uuid();
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ended_at, ref_id)
		VALUES (semi1_id, week_id, team_ids[1], team_ids[2], 'semifinal', 'Field 1', v_season.start_time, home_score, away_score, (week_date + v_season.start_time) + interval '2 hours', ref_id);
		semi1_winner_idx := CASE WHEN home_score > away_score THEN 1 ELSE 2 END;
		semi1_winner := team_ids[semi1_winner_idx];
		PERFORM pg_temp.seed_game_logs(semi1_id, shuffled_players[1:p_roster_size]);
		PERFORM pg_temp.seed_game_logs(semi1_id, shuffled_players[(p_roster_size + 1):(2 * p_roster_size)]);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		LOOP
			home_score := 3 + floor(random() * 13)::int;
			away_score := 3 + floor(random() * 13)::int;
			EXIT WHEN home_score <> away_score;
		END LOOP;
		semi2_id := gen_random_uuid();
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ended_at, ref_id)
		VALUES (semi2_id, week_id, team_ids[3], team_ids[4], 'semifinal', 'Field 2', v_season.start_time, home_score, away_score, (week_date + v_season.start_time) + interval '2 hours', ref_id);
		semi2_winner_idx := CASE WHEN home_score > away_score THEN 3 ELSE 4 END;
		semi2_winner := team_ids[semi2_winner_idx];
		PERFORM pg_temp.seed_game_logs(semi2_id, shuffled_players[(2 * p_roster_size + 1):(3 * p_roster_size)]);
		PERFORM pg_temp.seed_game_logs(semi2_id, shuffled_players[(3 * p_roster_size + 1):(4 * p_roster_size)]);

		-- Final: matchup is set from the semifinal winners. If the final
		-- hasn't been played yet, nobody's entered a score — this is the
		-- "currently in playoffs" state.
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + ((p_total_weeks + 1) * 7);
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (week_id, p_season_id, p_total_weeks + 2, week_date);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		final_id := gen_random_uuid();

		IF p_final_played THEN
			LOOP
				home_score := 3 + floor(random() * 13)::int;
				away_score := 3 + floor(random() * 13)::int;
				EXIT WHEN home_score <> away_score;
			END LOOP;

			INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ended_at, ref_id)
			VALUES (final_id, week_id, semi1_winner, semi2_winner, 'final', 'Field 1', v_season.start_time, home_score, away_score, (week_date + v_season.start_time) + interval '2 hours', ref_id);

			final_winner := CASE WHEN home_score > away_score THEN semi1_winner ELSE semi2_winner END;
			PERFORM pg_temp.seed_game_logs(
				final_id,
				shuffled_players[((semi1_winner_idx - 1) * p_roster_size + 1):(semi1_winner_idx * p_roster_size)]
			);
			PERFORM pg_temp.seed_game_logs(
				final_id,
				shuffled_players[((semi2_winner_idx - 1) * p_roster_size + 1):(semi2_winner_idx * p_roster_size)]
			);

			UPDATE seasons SET winner_id = final_winner WHERE id = p_season_id;

			-- The season's playoff MVP — only decided once the final's
			-- actually been played (that's what "playoff run is over"
			-- means here), drawn from every quarterfinal/semifinal/final
			-- game_logs row logged this season.
			SELECT gl.user_id INTO mvp_candidate
			FROM game_logs gl
			JOIN games g ON g.id = gl.game_id
			JOIN weeks wk ON wk.id = g.week_id
			WHERE wk.season_id = p_season_id AND g.round IN ('quarterfinal', 'semifinal', 'final')
			ORDER BY random() LIMIT 1;

			INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
			VALUES (gen_random_uuid(), NULL, p_season_id, 'playoff', mvp_candidate);
		ELSE
			INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, ref_id)
			VALUES (final_id, week_id, semi1_winner, semi2_winner, 'final', 'Field 1', v_season.start_time, ref_id);
		END IF;
	END IF;
END;
$fn$;

DO $$
DECLARE
	v_league_id uuid;
	v_future_id uuid;
	v_soon_id uuid;
	v_active_id uuid;
	v_playoffs_id uuid;
	v_completed_id uuid;

	-- Every season's lifecycle stage is defined purely as an offset from
	-- today, so re-running this script always reproduces the same five
	-- stages relative to "now" — "today" meaning the current date in LA,
	-- where the league actually plays, not whatever timezone the DB
	-- session happens to be in. Each start date is then snapped onto the
	-- season's own day_of_week (set below, per season) via week_anchor, so
	-- games land on the weekday they're supposed to instead of whatever
	-- weekday a raw "N days ago" offset happened to fall on.
	v_today date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
	v_future_start date := pg_temp.week_anchor(v_today + 75, 'sunday'); -- registration open, well out
	v_soon_start date := pg_temp.week_anchor(v_today + 9, 'wednesday'); -- registration open, starts within 2 weeks
	-- Week 4's date (v_active_start + 21) lands on the Saturday within
	-- today's own Sunday-Saturday span, so it's the one the schedule tab
	-- badges "this week" — matching p_completed_weeks=3/p_post_next_week=true
	-- below, which seeds week 4 as the in-progress one.
	v_active_start date := pg_temp.week_anchor(v_today, 'saturday') - 21; -- 3 weeks into an 8-week regular season
	v_playoffs_start date := pg_temp.week_anchor(v_today - 59, 'saturday'); -- regular season done, mid-playoffs
	v_completed_start date := pg_temp.week_anchor(v_today - 120, 'sunday'); -- entire season + playoffs long finished

	first_names text[] := ARRAY['Alex','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Cameron','Avery','Quinn','Drew','Reese','Rowan','Skyler','Dakota','Emerson','Finley','Hayden','Kendall','Peyton'];
	last_names text[] := ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Clark','Moore','Jackson','Martin','Lee'];
	playoffs_team_names text[] := ARRAY['Sole Purpose','Kicked Out','Punt Intended','Kick-Ass Krew'];
	active_team_names text[] := ARRAY['The Base Invaders','Sneaker Squad','Rubber Ballers','The Diamond Divas','Sole Crushers','Turf Titans'];
	soon_team_names text[] := ARRAY['Kick Start','Early Birds','Fresh Kicks','Warm-Up Act'];
	future_team_names text[] := ARRAY['Turf Wars','Home Run Kickers','Cleat Street','Grass Stains'];
	completed_team_names text[] := ARRAY['Kickin'' Chicken','Foul Balls','The Kick-Offs','Ball Busters'];

	player_pool uuid[] := '{}';
	ref_pool uuid[] := '{}';

	i int;
	new_user_id uuid;

	active_team uuid;
	active_next_week_id uuid;
	soon_week1_id uuid;
	availability_1 uuid;
	availability_2 uuid;
	availability_3 uuid;
	new_free_agent_1 uuid;
	new_free_agent_2 uuid;
	soon_captain_team uuid;
	real_captain_id uuid;
BEGIN
	-- Wipe any previously seeded league (cascades away its seasons, teams,
	-- weeks, games, stats, MVPs, and free-agent data) and any leftover
	-- fake users, so this always reseeds clean relative to today.
	DELETE FROM leagues WHERE slug = 'cheviot-hills';
	DELETE FROM users WHERE email LIKE 'fake-player-%@example.com' OR email = 'fake-captain@example.com';

	INSERT INTO leagues (id, name, slug, location_name, location_url)
	VALUES (
		gen_random_uuid(),
		'Cheviot Hills',
		'cheviot-hills',
		'Cheviot Hills Recreation Center',
		'https://maps.google.com/?q=Cheviot+Hills+Recreation+Center'
	)
	RETURNING id INTO v_league_id;

	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_future_start),
		EXTRACT(YEAR FROM v_future_start)::smallint,
		'mens',
		pg_temp.season_quarter_label(v_future_start) || '-' || EXTRACT(YEAR FROM v_future_start)::int || '-mens',
		v_league_id,
		'sunday',
		'13:00',
		'15:00',
		v_future_start,
		8
	)
	RETURNING id INTO v_future_id;

	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_soon_start),
		EXTRACT(YEAR FROM v_soon_start)::smallint,
		'mens',
		pg_temp.season_quarter_label(v_soon_start) || '-' || EXTRACT(YEAR FROM v_soon_start)::int || '-mens',
		v_league_id,
		'wednesday',
		'18:30',
		'20:30',
		v_soon_start,
		8
	)
	RETURNING id INTO v_soon_id;

	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_active_start),
		EXTRACT(YEAR FROM v_active_start)::smallint,
		'coed',
		pg_temp.season_quarter_label(v_active_start) || '-' || EXTRACT(YEAR FROM v_active_start)::int || '-coed',
		v_league_id,
		'saturday',
		'10:00',
		'12:00',
		v_active_start,
		8
	)
	RETURNING id INTO v_active_id;

	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_playoffs_start),
		EXTRACT(YEAR FROM v_playoffs_start)::smallint,
		'coed',
		pg_temp.season_quarter_label(v_playoffs_start) || '-' || EXTRACT(YEAR FROM v_playoffs_start)::int || '-coed',
		v_league_id,
		'saturday',
		'10:00',
		'12:00',
		v_playoffs_start,
		8
	)
	RETURNING id INTO v_playoffs_id;

	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_completed_start),
		EXTRACT(YEAR FROM v_completed_start)::smallint,
		'mens',
		pg_temp.season_quarter_label(v_completed_start) || '-' || EXTRACT(YEAR FROM v_completed_start)::int || '-mens',
		v_league_id,
		'sunday',
		'13:00',
		'15:00',
		v_completed_start,
		8
	)
	RETURNING id INTO v_completed_id;

	-- 56 players + 6 referees. password_hash is a placeholder, not a
	-- real argon2 hash — these fake accounts are for display only and
	-- can't log in through the app.
	FOR i IN 1..62 LOOP
		new_user_id := gen_random_uuid();
		INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin, is_ref)
		VALUES (
			new_user_id,
			first_names[1 + floor(random() * array_length(first_names, 1))::int],
			last_names[1 + floor(random() * array_length(last_names, 1))::int],
			'fake-player-' || i || '@example.com',
			'555' || lpad(i::text, 7, '0'),
			'seed-data-not-a-real-hash',
			false,
			i <= 6
		);
		IF i <= 6 THEN
			ref_pool := array_append(ref_pool, new_user_id);
		ELSE
			player_pool := array_append(player_pool, new_user_id);
		END IF;
	END LOOP;

	-- Future: registration open, no teams have registered yet — exercises
	-- the "no registered teams" empty state on the standings/teams tabs.
	PERFORM pg_temp.seed_season(v_future_id, 0, 10, 8, 0, false, false, false, false, future_team_names, player_pool, ref_pool);

	-- Starting soon: registration open, kicks off within the next two weeks.
	PERFORM pg_temp.seed_season(v_soon_id, 4, 10, 8, 0, false, false, false, false, soon_team_names, player_pool, ref_pool);

	-- Active: partway through an 8-week regular season (3 weeks played),
	-- 6 teams so this week has 3 games — one upcoming, one completed, and
	-- one in progress (lineups set, a couple of plays logged) so the
	-- schedule tab and ref tooling both have a live case to exercise.
	-- Roster size is 8 (not the usual 10) so 6 teams still fit the shared
	-- 56-player pool. Week 1's first game is suspended (rained out early)
	-- so there's a real example of that status in a past week.
	PERFORM pg_temp.seed_season(v_active_id, 6, 8, 8, 3, false, false, true, true, active_team_names, player_pool, ref_pool);

	-- Playoffs: regular season complete, semifinals played, final scheduled but not played.
	PERFORM pg_temp.seed_season(v_playoffs_id, 4, 10, 8, 8, true, false, false, false, playoffs_team_names, player_pool, ref_pool);

	-- Completed: entire season including the final has been played, winner recorded.
	PERFORM pg_temp.seed_season(v_completed_id, 4, 10, 8, 8, true, true, false, false, completed_team_names, player_pool, ref_pool);

	-- Two players who've never suited up anywhere — kept out of
	-- player_pool above so they never land on a roster or in game_logs.
	-- Gives the free-agent/weekly-sub cards a real "new player, no games
	-- logged" case instead of every row having career stats.
	new_free_agent_1 := gen_random_uuid();
	INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin, is_ref)
	VALUES (
		new_free_agent_1,
		first_names[1 + floor(random() * array_length(first_names, 1))::int],
		last_names[1 + floor(random() * array_length(last_names, 1))::int],
		'fake-player-newfa1@example.com',
		'5559990001',
		'seed-data-not-a-real-hash',
		false,
		false
	);
	new_free_agent_2 := gen_random_uuid();
	INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin, is_ref)
	VALUES (
		new_free_agent_2,
		first_names[1 + floor(random() * array_length(first_names, 1))::int],
		last_names[1 + floor(random() * array_length(last_names, 1))::int],
		'fake-player-newfa2@example.com',
		'5559990002',
		'seed-data-not-a-real-hash',
		false,
		false
	);

	-- A few free agents open against the summer 2026 men's season's first
	-- week (v_soon_id) — registration is open but nothing's been played
	-- yet, so this is the season-wide "Free Agents" pool: two experienced
	-- players plus the brand-new one above.
	SELECT id INTO soon_week1_id FROM weeks WHERE season_id = v_soon_id AND week_number = 1;

	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (gen_random_uuid(), player_pool[5], soon_week1_id);
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (gen_random_uuid(), player_pool[6], soon_week1_id);
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (gen_random_uuid(), new_free_agent_1, soon_week1_id);

	-- A real, loggable-in captain for one summer 2026 men's team — every
	-- other seeded player has a placeholder password_hash and can't
	-- authenticate, so this swaps in a real argon2 hash (password:
	-- "password123") on one team's captain slot to actually exercise the
	-- captain view. Roster/team otherwise untouched.
	SELECT id INTO soon_captain_team FROM teams WHERE season_id = v_soon_id ORDER BY name LIMIT 1;

	real_captain_id := gen_random_uuid();
	INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin, is_ref)
	VALUES (
		real_captain_id,
		'Test',
		'Captain',
		'fake-captain@example.com',
		'5559990003',
		'$argon2id$v=19$m=65536,p=4,t=3$DK/9jSdx18HcKXZ09uCxCA$caqcsSXOvBkL7aW4ph4ti1c0eyYQlM+PiVAaPmxXzTA',
		false,
		false
	);

	UPDATE team_memberships
	SET user_id = real_captain_id
	WHERE team_id = soon_captain_team AND is_captain = true;

	-- A few free agents open for the active season's next upcoming week
	-- (the "Weekly Subs" pool), one with a pending invite from a team,
	-- plus the other brand-new player so this tab also shows the
	-- "no games logged" case.
	SELECT id INTO active_next_week_id FROM weeks WHERE season_id = v_active_id AND week_number = 4;
	SELECT id INTO active_team FROM teams WHERE season_id = v_active_id ORDER BY name LIMIT 1;

	availability_1 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_1, player_pool[3], active_next_week_id);
	availability_2 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_2, player_pool[4], active_next_week_id);
	availability_3 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_3, new_free_agent_2, active_next_week_id);

	INSERT INTO free_agent_invites (id, team_id, availability_id, accepted_at)
	VALUES (gen_random_uuid(), active_team, availability_1, NULL);
END;
$$;

COMMIT;
