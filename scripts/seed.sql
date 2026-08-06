-- Fake dev data for the Cheviot Hills league, so frontend work (team
-- pages, schedules, box scores, career leaders, MVP awards, open-team
-- signups, free agents) has something real to render against.
--
-- Fully self-contained: creates the "cheviot-hills" league and its six
-- seasons itself, with every date computed relative to CURRENT_DATE, so
-- the seasons are always in the right lifecycle stage no matter when this
-- is run. The six seasons cover:
--   - future:        registration open, starts ~2.5 months out
--   - soon:          registration open, starts within the next two weeks
--   - active:        regular season in progress (partway through its weeks)
--   - quarterfinals: 8-team bracket, regular season done, quarterfinals
--                    played, semifinals scheduled but not yet played
--   - playoffs:      regular season done, semifinals played, final scheduled
--                    but not yet played
--   - completed:     entire season finished, final played, winner recorded
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

-- Scratch space for seed_completed_game's per-player tallies while it's
-- replaying a game — truncated at the start of every call, read back into
-- game_logs at the end. A temp table (rather than in-memory arrays keyed by
-- roster position) so accumulation is just "UPDATE ... WHERE user_id = x",
-- not manual index bookkeeping.
CREATE TEMP TABLE IF NOT EXISTS tmp_game_stats (
	user_id uuid PRIMARY KEY,
	at_bats int NOT NULL DEFAULT 0,
	runs int NOT NULL DEFAULT 0,
	rki int NOT NULL DEFAULT 0,
	singles int NOT NULL DEFAULT 0,
	doubles int NOT NULL DEFAULT 0,
	triples int NOT NULL DEFAULT 0,
	homers int NOT NULL DEFAULT 0,
	walks int NOT NULL DEFAULT 0,
	sacs int NOT NULL DEFAULT 0,
	extra_bases_taken int NOT NULL DEFAULT 0
);

-- Inserts a completed game (games row + a real inning-by-inning
-- game_plays log + game_logs tallied from those exact plays) instead of
-- picking an unconnected random final score and unconnected random box
-- score stats the way the old seed_game_logs did. The end-of-game rules
-- below are a deliberate mirror of domain/game-plays.ts replayGame — same
-- regulation-innings/mercy-rule/walk-off/tie constants, same order of
-- checks — so that if the app ever replays this seeded data through that
-- function, it agrees with what's stored here.
--
-- Base-running is intentionally the "standard" advance for each hit
-- (single = runners up one base, double = up two, triple/homer = everyone
-- scores), with a per-runner chance of taking an extra base beyond that —
-- mirroring the extra_bases_taken column's own doc comment (1st-to-3rd on
-- a single, scoring from 2nd on a single, etc). Outs never move a runner
-- (no double plays) — the only outcomes that touch existing runners are
-- hits, walks (force only), and sac (runner on 3rd only, otherwise it's
-- just an out).
CREATE OR REPLACE FUNCTION pg_temp.seed_completed_game(
	p_game_id uuid,
	p_week_id uuid,
	p_home_team_id uuid,
	p_away_team_id uuid,
	p_round game_round,
	p_field text,
	p_start_time time,
	p_ended_at timestamp,
	p_ref_id uuid,
	p_home_roster uuid[],
	p_away_roster uuid[]
) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
	v_home_size int := array_length(p_home_roster, 1);
	v_away_size int := array_length(p_away_roster, 1);
	v_home_idx int := 1;
	v_away_idx int := 1;
	v_inning int := 1;
	v_half smallint := 0; -- 0 = top (away batting), 1 = bottom (home batting)
	v_outs int := 0;
	v_runs_this_half int := 0;
	v_home_score int := 0;
	v_away_score int := 0;
	v_seq int := 1;
	v_batter uuid;
	v_outcome text;
	v_roll float;
	v_b1 uuid; v_b2 uuid; v_b3 uuid;
	v_n1 uuid; v_n2 uuid; v_n3 uuid;
	v_bases uuid[] := ARRAY[NULL, NULL, NULL]::uuid[];
	v_runner_events jsonb;
	v_runs_on_play int;
	v_batter_scored boolean;
	v_outs_on_play int;
BEGIN
	INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, ref_id)
	VALUES (p_game_id, p_week_id, p_home_team_id, p_away_team_id, p_round, p_field, p_start_time, p_ref_id);

	TRUNCATE tmp_game_stats;
	INSERT INTO tmp_game_stats (user_id)
	SELECT DISTINCT uid FROM unnest(p_home_roster || p_away_roster) AS uid;

	LOOP
		-- Safety valve for a pathological string of extra-inning ties in
		-- playoff rounds — practically never hit, since each extra half
		-- inning has many chances to break a tie.
		EXIT WHEN v_inning > 20;

		IF v_half = 0 THEN
			v_batter := p_away_roster[((v_away_idx - 1) % v_away_size) + 1];
			v_away_idx := v_away_idx + 1;
		ELSE
			v_batter := p_home_roster[((v_home_idx - 1) % v_home_size) + 1];
			v_home_idx := v_home_idx + 1;
		END IF;

		v_b1 := v_bases[1]; v_b2 := v_bases[2]; v_b3 := v_bases[3];
		v_n1 := NULL; v_n2 := NULL; v_n3 := NULL;
		v_runner_events := '[]'::jsonb;
		v_runs_on_play := 0;
		v_batter_scored := false;
		v_outs_on_play := 0;

		v_roll := random();
		IF v_roll < 0.09 THEN
			v_outcome := 'walk';
		ELSIF v_roll < 0.64 THEN
			v_outcome := 'out';
		ELSIF v_roll < 0.84 THEN
			v_outcome := 'single';
		ELSIF v_roll < 0.95 THEN
			v_outcome := 'double';
		ELSIF v_roll < 0.98 THEN
			v_outcome := 'triple';
		ELSE
			v_outcome := 'homer';
		END IF;

		-- Sac fly: only makes sense with a runner on 3rd and fewer than 2
		-- outs (need the sac to bring someone home).
		IF v_outcome = 'out' AND v_b3 IS NOT NULL AND v_outs < 2 AND random() < 0.25 THEN
			v_outcome := 'sac';
		END IF;

		-- Every runner who started this play on base gets exactly one entry
		-- below — scored, out, held (toBase = fromBase), or advanced
		-- (toBase = wherever they ended up) — so a consumer can reconstruct
		-- the exact bases-occupied state after any play without having to
		-- infer "no entry means they didn't move" (they might have moved to
		-- a base that just isn't communicated).
		IF v_outcome = 'walk' THEN
			-- Force advances only — runners not directly forced hold.
			IF v_b1 IS NOT NULL THEN
				IF v_b2 IS NOT NULL THEN
					IF v_b3 IS NOT NULL THEN
						v_runner_events := v_runner_events || jsonb_build_array(
							jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'scored'));
						v_runs_on_play := v_runs_on_play + 1;
					END IF;
					v_n3 := v_b2;
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'advanced', 'toBase', 3));
				ELSE
					v_n3 := v_b3;
					IF v_b3 IS NOT NULL THEN
						v_runner_events := v_runner_events || jsonb_build_array(
							jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'held', 'toBase', 3));
					END IF;
				END IF;
				v_n2 := v_b1;
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'advanced', 'toBase', 2));
			ELSE
				v_n2 := v_b2;
				v_n3 := v_b3;
				IF v_b2 IS NOT NULL THEN
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'held', 'toBase', 2));
				END IF;
				IF v_b3 IS NOT NULL THEN
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'held', 'toBase', 3));
				END IF;
			END IF;
			v_n1 := v_batter;
			UPDATE tmp_game_stats SET walks = walks + 1 WHERE user_id = v_batter;

		ELSIF v_outcome = 'single' THEN
			IF v_b3 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b2 IS NOT NULL THEN
				IF random() < 0.65 THEN
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'scored'));
					v_runs_on_play := v_runs_on_play + 1;
					UPDATE tmp_game_stats SET extra_bases_taken = extra_bases_taken + 1 WHERE user_id = v_b2;
				ELSE
					v_n3 := v_b2;
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'advanced', 'toBase', 3));
				END IF;
			END IF;
			IF v_b1 IS NOT NULL THEN
				v_roll := random();
				IF v_roll < 0.05 THEN
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'scored'));
					v_runs_on_play := v_runs_on_play + 1;
					UPDATE tmp_game_stats SET extra_bases_taken = extra_bases_taken + 2 WHERE user_id = v_b1;
				ELSIF v_roll < 0.25 AND v_n3 IS NULL THEN
					v_n3 := v_b1;
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'advanced', 'toBase', 3));
					UPDATE tmp_game_stats SET extra_bases_taken = extra_bases_taken + 1 WHERE user_id = v_b1;
				ELSE
					v_n2 := v_b1;
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'advanced', 'toBase', 2));
				END IF;
			END IF;
			v_n1 := v_batter;
			UPDATE tmp_game_stats SET at_bats = at_bats + 1, singles = singles + 1 WHERE user_id = v_batter;

		ELSIF v_outcome = 'double' THEN
			IF v_b3 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b2 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b1 IS NOT NULL THEN
				IF random() < 0.40 THEN
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'scored'));
					v_runs_on_play := v_runs_on_play + 1;
					UPDATE tmp_game_stats SET extra_bases_taken = extra_bases_taken + 1 WHERE user_id = v_b1;
				ELSE
					v_n3 := v_b1;
					v_runner_events := v_runner_events || jsonb_build_array(
						jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'advanced', 'toBase', 3));
				END IF;
			END IF;
			v_n2 := v_batter;
			UPDATE tmp_game_stats SET at_bats = at_bats + 1, doubles = doubles + 1 WHERE user_id = v_batter;

		ELSIF v_outcome = 'triple' THEN
			IF v_b3 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b2 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b1 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			v_n3 := v_batter;
			UPDATE tmp_game_stats SET at_bats = at_bats + 1, triples = triples + 1 WHERE user_id = v_batter;

		ELSIF v_outcome = 'homer' THEN
			IF v_b3 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b2 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			IF v_b1 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'scored'));
				v_runs_on_play := v_runs_on_play + 1;
			END IF;
			v_batter_scored := true;
			UPDATE tmp_game_stats SET at_bats = at_bats + 1, homers = homers + 1 WHERE user_id = v_batter;

		ELSIF v_outcome = 'sac' THEN
			v_runner_events := v_runner_events || jsonb_build_array(
				jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'scored'));
			v_runs_on_play := v_runs_on_play + 1;
			v_n1 := v_b1;
			v_n2 := v_b2;
			IF v_b1 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'held', 'toBase', 1));
			END IF;
			IF v_b2 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'held', 'toBase', 2));
			END IF;
			v_outs_on_play := 1;
			UPDATE tmp_game_stats SET sacs = sacs + 1 WHERE user_id = v_batter;

		ELSE -- 'out'
			v_n1 := v_b1; v_n2 := v_b2; v_n3 := v_b3;
			IF v_b1 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b1, 'fromBase', 1, 'result', 'held', 'toBase', 1));
			END IF;
			IF v_b2 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b2, 'fromBase', 2, 'result', 'held', 'toBase', 2));
			END IF;
			IF v_b3 IS NOT NULL THEN
				v_runner_events := v_runner_events || jsonb_build_array(
					jsonb_build_object('runnerId', v_b3, 'fromBase', 3, 'result', 'held', 'toBase', 3));
			END IF;
			v_outs_on_play := 1;
			UPDATE tmp_game_stats SET at_bats = at_bats + 1 WHERE user_id = v_batter;
		END IF;

		UPDATE tmp_game_stats SET runs = runs + 1
			WHERE user_id IN (
				SELECT (e ->> 'runnerId')::uuid FROM jsonb_array_elements(v_runner_events) e
				WHERE e ->> 'result' = 'scored'
			);
		UPDATE tmp_game_stats
			SET rki = rki + v_runs_on_play + (CASE WHEN v_batter_scored THEN 1 ELSE 0 END)
			WHERE user_id = v_batter;
		IF v_batter_scored THEN
			UPDATE tmp_game_stats SET runs = runs + 1 WHERE user_id = v_batter;
		END IF;

		v_bases := ARRAY[v_n1, v_n2, v_n3];

		INSERT INTO game_plays (id, game_id, sequence, batter_id, outcome, half, inning, runner_events)
		VALUES (gen_random_uuid(), p_game_id, v_seq, v_batter, v_outcome::play_outcome, v_half, v_inning, v_runner_events);
		v_seq := v_seq + 1;

		v_outs := v_outs + v_outs_on_play;
		v_runs_on_play := v_runs_on_play + (CASE WHEN v_batter_scored THEN 1 ELSE 0 END);
		v_runs_this_half := v_runs_this_half + v_runs_on_play;
		IF v_half = 0 THEN
			v_away_score := v_away_score + v_runs_on_play;
		ELSE
			v_home_score := v_home_score + v_runs_on_play;
		END IF;

		-- Mid-at-bat end conditions: mercy rule while the home team is
		-- batting, and a bottom-of-7th-or-later walk-off, both checked the
		-- instant the score crosses the line rather than waiting for 3 outs.
		IF v_half = 1 AND v_inning >= 4 AND v_home_score - v_away_score >= 15 THEN
			EXIT;
		END IF;
		IF v_half = 1 AND v_inning >= 7 AND v_home_score > v_away_score THEN
			EXIT;
		END IF;

		IF v_outs < 3 AND v_runs_this_half < 10 THEN
			CONTINUE;
		END IF;

		IF v_half = 0 THEN
			-- Top half just ended — skip the bottom half if home is
			-- already ahead walking in and it's the last inning.
			IF v_inning >= 7 AND v_home_score > v_away_score THEN
				EXIT;
			END IF;
			v_half := 1;
			v_outs := 0;
			v_runs_this_half := 0;
			v_bases := ARRAY[NULL, NULL, NULL]::uuid[];
			CONTINUE;
		END IF;

		-- Bottom half just ended — the inning is fully complete.
		IF v_inning >= 4 AND v_away_score - v_home_score >= 15 THEN
			EXIT;
		END IF;
		IF v_inning >= 7 THEN
			-- Not tied, or a regular-season game (which ends in a tie
			-- rather than playing extra innings): over. Otherwise
			-- (playoffs, still tied) fall through into extra innings.
			IF v_home_score <> v_away_score OR p_round = 'regular' THEN
				EXIT;
			END IF;
		END IF;

		v_inning := v_inning + 1;
		v_half := 0;
		v_outs := 0;
		v_runs_this_half := 0;
		v_bases := ARRAY[NULL, NULL, NULL]::uuid[];
	END LOOP;

	INSERT INTO game_logs (
		id, game_id, user_id, at_bats, runs, rki,
		singles, doubles, triples, homers, walks, sacs, extra_bases_taken
	)
	SELECT gen_random_uuid(), p_game_id, user_id, at_bats, runs, rki,
		singles, doubles, triples, homers, walks, sacs, extra_bases_taken
	FROM tmp_game_stats;

	UPDATE games SET home_score = v_home_score, away_score = v_away_score, ended_at = p_ended_at
	WHERE id = p_game_id;
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
	-- Standard 8-team round-robin (circle method): 7 rounds, 4 pairs each.
	pairing_sets_8 int[][] := ARRAY[
		ARRAY[1,8,2,7,3,6,4,5],
		ARRAY[1,7,8,6,2,5,3,4],
		ARRAY[1,6,7,5,8,4,2,3],
		ARRAY[1,5,6,4,7,3,8,2],
		ARRAY[1,4,5,3,6,2,7,8],
		ARRAY[1,3,4,2,5,8,6,7],
		ARRAY[1,2,3,8,4,7,5,6]
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
	qf1_id uuid;
	qf2_id uuid;
	qf3_id uuid;
	qf4_id uuid;
	qf1_winner uuid;
	qf2_winner uuid;
	qf3_winner uuid;
	qf4_winner uuid;
	qf1_winner_idx int;
	qf2_winner_idx int;
	qf3_winner_idx int;
	qf4_winner_idx int;
BEGIN
	SELECT * INTO v_season FROM seasons WHERE id = p_season_id;

	IF p_team_count = 8 THEN
		active_pairing_sets := pairing_sets_8;
		round_count := 7;
	ELSIF p_team_count = 6 THEN
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

	-- Register this season's ref pool in season_referees — assigning a
	-- game's ref_id validates against season_referees for that game's
	-- season (see games.ts), so a ref used below without a row here
	-- would be a ref the app itself could never have assigned.
	FOR g IN 1..array_length(p_ref_pool, 1) LOOP
		INSERT INTO season_referees (id, season_id, user_id)
		VALUES (gen_random_uuid(), p_season_id, p_ref_pool[g]);
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
					PERFORM pg_temp.seed_completed_game(
						game_id, week_id, home_team, away_team, 'regular', 'Field ' || g,
						v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
						shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)],
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

			-- Game 2: completed — final score, play-by-play + box score, ended_at set.
			home_idx := active_pairing_sets[set_idx][3];
			away_idx := active_pairing_sets[set_idx][4];
			ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];

			game_id := gen_random_uuid();
			PERFORM pg_temp.seed_completed_game(
				game_id, week_id, team_ids[home_idx], team_ids[away_idx], 'regular', 'Field 2',
				v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
				shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)],
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

	IF p_add_playoffs AND p_team_count = 8 THEN
		-- 8-team bracket, stopped right after quarterfinals: this is the
		-- only playoff stage seed_season builds for an 8-team season, so
		-- p_final_played is ignored here — quarterfinals are played,
		-- semifinal matchups are set from the QF winners, but not played.
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + (p_total_weeks * 7);
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (week_id, p_season_id, p_total_weeks + 1, week_date);

		-- QF1: teams[1] v teams[8]
		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		qf1_id := gen_random_uuid();
		PERFORM pg_temp.seed_completed_game(
			qf1_id, week_id, team_ids[1], team_ids[8], 'quarterfinal', 'Field 1',
			v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
			shuffled_players[1:p_roster_size],
			shuffled_players[(7 * p_roster_size + 1):(8 * p_roster_size)]
		);
		SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = qf1_id;
		qf1_winner_idx := CASE WHEN home_score > away_score THEN 1 ELSE 8 END;
		qf1_winner := team_ids[qf1_winner_idx];

		-- QF2: teams[2] v teams[7]
		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		qf2_id := gen_random_uuid();
		PERFORM pg_temp.seed_completed_game(
			qf2_id, week_id, team_ids[2], team_ids[7], 'quarterfinal', 'Field 2',
			v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
			shuffled_players[(p_roster_size + 1):(2 * p_roster_size)],
			shuffled_players[(6 * p_roster_size + 1):(7 * p_roster_size)]
		);
		SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = qf2_id;
		qf2_winner_idx := CASE WHEN home_score > away_score THEN 2 ELSE 7 END;
		qf2_winner := team_ids[qf2_winner_idx];

		-- QF3: teams[3] v teams[6]
		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		qf3_id := gen_random_uuid();
		PERFORM pg_temp.seed_completed_game(
			qf3_id, week_id, team_ids[3], team_ids[6], 'quarterfinal', 'Field 3',
			v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
			shuffled_players[(2 * p_roster_size + 1):(3 * p_roster_size)],
			shuffled_players[(5 * p_roster_size + 1):(6 * p_roster_size)]
		);
		SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = qf3_id;
		qf3_winner_idx := CASE WHEN home_score > away_score THEN 3 ELSE 6 END;
		qf3_winner := team_ids[qf3_winner_idx];

		-- QF4: teams[4] v teams[5]
		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		qf4_id := gen_random_uuid();
		PERFORM pg_temp.seed_completed_game(
			qf4_id, week_id, team_ids[4], team_ids[5], 'quarterfinal', 'Field 4',
			v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
			shuffled_players[(3 * p_roster_size + 1):(4 * p_roster_size)],
			shuffled_players[(4 * p_roster_size + 1):(5 * p_roster_size)]
		);
		SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = qf4_id;
		qf4_winner_idx := CASE WHEN home_score > away_score THEN 4 ELSE 5 END;
		qf4_winner := team_ids[qf4_winner_idx];

		-- Semifinals: matchups are set from the QF winners, but nobody's
		-- played yet — this is the "just past quarterfinals" state.
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + ((p_total_weeks + 1) * 7);
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (week_id, p_season_id, p_total_weeks + 2, week_date);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, ref_id)
		VALUES (gen_random_uuid(), week_id, qf1_winner, qf2_winner, 'semifinal', 'Field 1', v_season.start_time, ref_id);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, ref_id)
		VALUES (gen_random_uuid(), week_id, qf3_winner, qf4_winner, 'semifinal', 'Field 2', v_season.start_time, ref_id);

		-- Final: matchup isn't known yet (semis haven't been played), but
		-- this league runs semis and the final as a single championship
		-- day — so the date is already on the calendar, same as the
		-- semifinals' week, even though there's no game to hang it off of.
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (gen_random_uuid(), p_season_id, p_total_weeks + 3, week_date);
	ELSIF p_add_playoffs THEN
		-- Semifinals: teams[1] v teams[2], teams[3] v teams[4] — already played.
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + (p_total_weeks * 7);
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (week_id, p_season_id, p_total_weeks + 1, week_date);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		semi1_id := gen_random_uuid();
		PERFORM pg_temp.seed_completed_game(
			semi1_id, week_id, team_ids[1], team_ids[2], 'semifinal', 'Field 1',
			v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
			shuffled_players[1:p_roster_size],
			shuffled_players[(p_roster_size + 1):(2 * p_roster_size)]
		);
		SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = semi1_id;
		semi1_winner_idx := CASE WHEN home_score > away_score THEN 1 ELSE 2 END;
		semi1_winner := team_ids[semi1_winner_idx];

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		semi2_id := gen_random_uuid();
		PERFORM pg_temp.seed_completed_game(
			semi2_id, week_id, team_ids[3], team_ids[4], 'semifinal', 'Field 2',
			v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
			shuffled_players[(2 * p_roster_size + 1):(3 * p_roster_size)],
			shuffled_players[(3 * p_roster_size + 1):(4 * p_roster_size)]
		);
		SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = semi2_id;
		semi2_winner_idx := CASE WHEN home_score > away_score THEN 3 ELSE 4 END;
		semi2_winner := team_ids[semi2_winner_idx];

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
			PERFORM pg_temp.seed_completed_game(
				final_id, week_id, semi1_winner, semi2_winner, 'final', 'Field 1',
				v_season.start_time, (week_date + v_season.start_time) + interval '2 hours', ref_id,
				shuffled_players[((semi1_winner_idx - 1) * p_roster_size + 1):(semi1_winner_idx * p_roster_size)],
				shuffled_players[((semi2_winner_idx - 1) * p_roster_size + 1):(semi2_winner_idx * p_roster_size)]
			);
			SELECT games.home_score, games.away_score INTO home_score, away_score FROM games WHERE id = final_id;

			final_winner := CASE WHEN home_score > away_score THEN semi1_winner ELSE semi2_winner END;

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
	v_quarterfinals_id uuid;
	v_playoffs_id uuid;
	v_completed_id uuid;

	-- Every season's lifecycle stage is defined purely as an offset from
	-- today, so re-running this script always reproduces the same six
	-- stages relative to "now" — "today" meaning the current date in LA,
	-- where the league actually plays, not whatever timezone the DB
	-- session happens to be in. Each start date is then snapped onto the
	-- season's own day_of_week (set below, per season) via week_anchor, so
	-- games land on the weekday they're supposed to instead of whatever
	-- weekday a raw "N days ago" offset happened to fall on.
	--
	-- Because these six offsets are fixed distances from "today," several
	-- pairs are close enough together (well under a quarter's ~91-day span)
	-- that they land in the same quarter+year on many days of the year —
	-- and some of those pairs share a division, which used to make their
	-- quarter-year-division slugs collide on the seasons table's
	-- (league_id, slug) unique constraint. Splitting the six into just two
	-- divisions can't fix this in general (playoffs/quarterfinals/active
	-- are mutually close enough to need 3+ colors), so each slug below
	-- gets an explicit per-stage suffix (-future, -soon, -active,
	-- -quarterfinals, -playoffs, -completed) instead of relying on
	-- quarter+division for uniqueness.
	v_today date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
	v_future_start date := pg_temp.week_anchor(v_today + 75, 'sunday'); -- registration open, well out
	v_soon_start date := pg_temp.week_anchor(v_today + 9, 'wednesday'); -- registration open, starts within 2 weeks
	-- Week 4's date (v_active_start + 21) lands on the Saturday within
	-- today's own Sunday-Saturday span, so it's the one the schedule tab
	-- badges "this week" — matching p_completed_weeks=3/p_post_next_week=true
	-- below, which seeds week 4 as the in-progress one.
	v_active_start date := pg_temp.week_anchor(v_today, 'saturday') - 21; -- 3 weeks into an 8-week regular season
	-- Week 9 (quarterfinals, p_total_weeks + 1) lands a couple of days in
	-- the past and week 10 (semifinals, p_total_weeks + 2) a few days out,
	-- so quarterfinals read as played and semifinals as scheduled-not-played.
	v_quarterfinals_start date := pg_temp.week_anchor(v_today - 58, 'tuesday');
	-- -63 (not -59): the season-card badge (season-card.tsx) buckets purely
	-- off startDate + weeks, independent of actual game data — anything
	-- less than 63 days back can land inside its 8-week "In Progress"
	-- window instead of "Playoffs" once week_anchor's up-to-6-day snap is
	-- applied, which would make a season with semifinals already played
	-- (and a regular-season MVP already awarded) still read as in-progress.
	-- -63 keeps this in the "Playoffs" bucket for every day of the year.
	v_playoffs_start date := pg_temp.week_anchor(v_today - 63, 'saturday'); -- regular season done, mid-playoffs
	v_completed_start date := pg_temp.week_anchor(v_today - 120, 'sunday'); -- entire season + playoffs long finished

	first_names text[] := ARRAY['Alex','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Cameron','Avery','Quinn','Drew','Reese','Rowan','Skyler','Dakota','Emerson','Finley','Hayden','Kendall','Peyton'];
	last_names text[] := ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Clark','Moore','Jackson','Martin','Lee'];
	playoffs_team_names text[] := ARRAY['Sole Purpose','Kicked Out','Punt Intended','Kick-Ass Krew'];
	active_team_names text[] := ARRAY['The Base Invaders','Sneaker Squad','Rubber Ballers','The Diamond Divas','Sole Crushers','Turf Titans'];
	quarterfinals_team_names text[] := ARRAY['Fowl Territory','Grass Kickers','Rally Kickers','Kick Six','Diamond Dynasty','The Kicking Dead','Balls to the Wall','Old School Kickers'];
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
		pg_temp.season_quarter_label(v_future_start) || '-' || EXTRACT(YEAR FROM v_future_start)::int || '-mens-future',
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
		pg_temp.season_quarter_label(v_soon_start) || '-' || EXTRACT(YEAR FROM v_soon_start)::int || '-mens-soon',
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
		pg_temp.season_quarter_label(v_active_start) || '-' || EXTRACT(YEAR FROM v_active_start)::int || '-coed-active',
		v_league_id,
		'saturday',
		'10:00',
		'12:00',
		v_active_start,
		8
	)
	RETURNING id INTO v_active_id;

	-- 'mens': this season's regular-season MVPs exercise the single-winner
	-- path instead of duplicating coed's guy/girl split, which
	-- active/playoffs already cover. (The slug's '-quarterfinals' suffix
	-- below, not the division, is what keeps this from colliding with the
	-- other seasons on (league_id, slug) — see the note above v_today.)
	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_quarterfinals_start),
		EXTRACT(YEAR FROM v_quarterfinals_start)::smallint,
		'mens',
		pg_temp.season_quarter_label(v_quarterfinals_start) || '-' || EXTRACT(YEAR FROM v_quarterfinals_start)::int || '-mens-quarterfinals',
		v_league_id,
		'tuesday',
		'19:00',
		'21:00',
		v_quarterfinals_start,
		8
	)
	RETURNING id INTO v_quarterfinals_id;

	INSERT INTO seasons (id, season, year, division, slug, league_id, day_of_week, start_time, end_time, start_date, weeks)
	VALUES (
		gen_random_uuid(),
		pg_temp.season_quarter_label(v_playoffs_start),
		EXTRACT(YEAR FROM v_playoffs_start)::smallint,
		'coed',
		pg_temp.season_quarter_label(v_playoffs_start) || '-' || EXTRACT(YEAR FROM v_playoffs_start)::int || '-coed-playoffs',
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
		pg_temp.season_quarter_label(v_completed_start) || '-' || EXTRACT(YEAR FROM v_completed_start)::int || '-mens-completed',
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
		INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin)
		VALUES (
			new_user_id,
			first_names[1 + floor(random() * array_length(first_names, 1))::int],
			last_names[1 + floor(random() * array_length(last_names, 1))::int],
			'fake-player-' || i || '@example.com',
			'555' || lpad(i::text, 7, '0'),
			'seed-data-not-a-real-hash',
			false
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

	-- Quarterfinals: 8-team bracket, regular season complete, quarterfinals
	-- played, semifinal matchups set from the QF winners but not played yet.
	-- Roster size 6 (48 players) keeps 8 teams within the shared 56-player pool.
	PERFORM pg_temp.seed_season(v_quarterfinals_id, 8, 6, 8, 8, true, false, false, false, quarterfinals_team_names, player_pool, ref_pool);

	-- Playoffs: regular season complete, semifinals played, final scheduled but not played.
	PERFORM pg_temp.seed_season(v_playoffs_id, 4, 10, 8, 8, true, false, false, false, playoffs_team_names, player_pool, ref_pool);

	-- Completed: entire season including the final has been played, winner recorded.
	PERFORM pg_temp.seed_season(v_completed_id, 4, 10, 8, 8, true, true, false, false, completed_team_names, player_pool, ref_pool);

	-- Two players who've never suited up anywhere — kept out of
	-- player_pool above so they never land on a roster or in game_logs.
	-- Gives the free-agent/weekly-sub cards a real "new player, no games
	-- logged" case instead of every row having career stats.
	new_free_agent_1 := gen_random_uuid();
	INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin)
	VALUES (
		new_free_agent_1,
		first_names[1 + floor(random() * array_length(first_names, 1))::int],
		last_names[1 + floor(random() * array_length(last_names, 1))::int],
		'fake-player-newfa1@example.com',
		'5559990001',
		'seed-data-not-a-real-hash',
		false
	);
	new_free_agent_2 := gen_random_uuid();
	INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin)
	VALUES (
		new_free_agent_2,
		first_names[1 + floor(random() * array_length(first_names, 1))::int],
		last_names[1 + floor(random() * array_length(last_names, 1))::int],
		'fake-player-newfa2@example.com',
		'5559990002',
		'seed-data-not-a-real-hash',
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
	-- captain view. Roster/team otherwise untouched. This same user is also
	-- made captain of a team in the in-progress regular season below, so
	-- there's a team with an active roster/upcoming week to exercise
	-- "set lineup" against too.
	SELECT id INTO soon_captain_team FROM teams WHERE season_id = v_soon_id ORDER BY name LIMIT 1;

	real_captain_id := gen_random_uuid();
	INSERT INTO users (id, first_name, last_name, email, phone, password_hash, is_admin)
	VALUES (
		real_captain_id,
		'Test',
		'Captain',
		'fake-captain@example.com',
		'5559990003',
		'$argon2id$v=19$m=65536,p=4,t=3$DK/9jSdx18HcKXZ09uCxCA$caqcsSXOvBkL7aW4ph4ti1c0eyYQlM+PiVAaPmxXzTA',
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

	-- Same real captain login as above, also made captain of this
	-- in-progress regular season team so "set lineup" can be exercised
	-- against a real upcoming week (week 4), not just the pre-season team.
	UPDATE team_memberships
	SET user_id = real_captain_id
	WHERE team_id = active_team AND is_captain = true;

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
