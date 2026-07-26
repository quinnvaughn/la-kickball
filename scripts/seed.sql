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
			set_idx := ((w - 1) % 3) + 1;

			FOR g IN 1..2 LOOP
				IF g = 1 THEN
					home_idx := pairing_sets[set_idx][1];
					away_idx := pairing_sets[set_idx][2];
				ELSE
					home_idx := pairing_sets[set_idx][3];
					away_idx := pairing_sets[set_idx][4];
				END IF;

				home_team := team_ids[home_idx];
				away_team := team_ids[away_idx];
				ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];

				LOOP
					home_score := 3 + floor(random() * 13)::int;
					away_score := 3 + floor(random() * 13)::int;
					EXIT WHEN home_score <> away_score;
				END LOOP;

				game_id := gen_random_uuid();
				INSERT INTO games (
					id, week_id, home_team_id, away_team_id, round, field,
					start_time, home_score, away_score, ref_id
				) VALUES (
					game_id, week_id, home_team, away_team, 'regular',
					CASE WHEN g = 1 THEN 'Field 1' ELSE 'Field 2' END,
					v_season.start_time, home_score, away_score, ref_id
				);

				PERFORM pg_temp.seed_game_logs(
					game_id,
					shuffled_players[((home_idx - 1) * p_roster_size + 1):(home_idx * p_roster_size)]
				);
				PERFORM pg_temp.seed_game_logs(
					game_id,
					shuffled_players[((away_idx - 1) * p_roster_size + 1):(away_idx * p_roster_size)]
				);
			END LOOP;
		END IF;
	END LOOP;

	-- Weekly MVPs for every regular-season week that's actually happened,
	-- independent of whether the season has playoffs yet.
	FOR w IN 1..p_completed_weeks LOOP
		SELECT id INTO week_id FROM weeks WHERE season_id = p_season_id AND week_number = w;

		mvp_candidate := shuffled_players[1 + floor(random() * array_length(shuffled_players, 1))::int];
		INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
		VALUES (gen_random_uuid(), week_id, NULL, 'guy', mvp_candidate);

		mvp_candidate := shuffled_players[1 + floor(random() * array_length(shuffled_players, 1))::int];
		INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
		VALUES (gen_random_uuid(), week_id, NULL, 'girl', mvp_candidate);
	END LOOP;

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
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ref_id)
		VALUES (semi1_id, week_id, team_ids[1], team_ids[2], 'semifinal', 'Field 1', v_season.start_time, home_score, away_score, ref_id);
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
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ref_id)
		VALUES (semi2_id, week_id, team_ids[3], team_ids[4], 'semifinal', 'Field 2', v_season.start_time, home_score, away_score, ref_id);
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

			INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ref_id)
			VALUES (final_id, week_id, semi1_winner, semi2_winner, 'final', 'Field 1', v_season.start_time, home_score, away_score, ref_id);

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
	-- stages relative to "now".
	v_future_start date := CURRENT_DATE + 75; -- registration open, well out
	v_soon_start date := CURRENT_DATE + 9; -- registration open, starts within 2 weeks
	v_active_start date := CURRENT_DATE - 24; -- 3 weeks into an 8-week regular season
	v_playoffs_start date := CURRENT_DATE - 59; -- regular season done, mid-playoffs
	v_completed_start date := CURRENT_DATE - 120; -- entire season + playoffs long finished

	first_names text[] := ARRAY['Alex','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Cameron','Avery','Quinn','Drew','Reese','Rowan','Skyler','Dakota','Emerson','Finley','Hayden','Kendall','Peyton'];
	last_names text[] := ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Clark','Moore','Jackson','Martin','Lee'];
	playoffs_team_names text[] := ARRAY['Sole Purpose','Kicked Out','Punt Intended','Kick-Ass Krew'];
	active_team_names text[] := ARRAY['The Base Invaders','Sneaker Squad','Rubber Ballers','The Diamond Divas'];
	soon_team_names text[] := ARRAY['Kick Start','Early Birds','Fresh Kicks','Warm-Up Act'];
	future_team_names text[] := ARRAY['Turf Wars','Home Run Kickers','Cleat Street','Grass Stains'];
	completed_team_names text[] := ARRAY['Kickin'' Chicken','Foul Balls','The Kick-Offs','Ball Busters'];

	player_pool uuid[] := '{}';
	ref_pool uuid[] := '{}';

	i int;
	new_user_id uuid;

	future_open_team_1 uuid;
	future_open_team_2 uuid;
	active_team uuid;
	active_next_week_id uuid;
	availability_1 uuid;
	availability_2 uuid;
BEGIN
	-- Wipe any previously seeded league (cascades away its seasons, teams,
	-- weeks, games, stats, MVPs, and free-agent data) and any leftover
	-- fake users, so this always reseeds clean relative to today.
	DELETE FROM leagues WHERE slug = 'cheviot-hills';
	DELETE FROM users WHERE email LIKE 'fake-player-%@example.com';

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

	-- Future: registration open, rosters formed, nothing scheduled yet.
	PERFORM pg_temp.seed_season(v_future_id, 4, 10, 8, 0, false, false, future_team_names, player_pool, ref_pool);

	-- Starting soon: registration open, kicks off within the next two weeks.
	PERFORM pg_temp.seed_season(v_soon_id, 4, 10, 8, 0, false, false, soon_team_names, player_pool, ref_pool);

	-- Active: partway through an 8-week regular season (3 weeks played).
	PERFORM pg_temp.seed_season(v_active_id, 4, 10, 8, 3, false, false, active_team_names, player_pool, ref_pool);

	-- Playoffs: regular season complete, semifinals played, final scheduled but not played.
	PERFORM pg_temp.seed_season(v_playoffs_id, 4, 10, 8, 8, true, false, playoffs_team_names, player_pool, ref_pool);

	-- Completed: entire season including the final has been played, winner recorded.
	PERFORM pg_temp.seed_season(v_completed_id, 4, 10, 8, 8, true, true, completed_team_names, player_pool, ref_pool);

	-- A couple of open teams on the future season + join requests, so the
	-- "still recruiting" team state has something to look at.
	SELECT id INTO future_open_team_1 FROM teams WHERE season_id = v_future_id ORDER BY name LIMIT 1;
	SELECT id INTO future_open_team_2 FROM teams WHERE season_id = v_future_id ORDER BY name OFFSET 1 LIMIT 1;

	UPDATE teams SET is_open = true, invite_code = upper(substr(md5(random()::text), 1, 6)) WHERE id = future_open_team_1;
	UPDATE teams SET is_open = true, invite_code = upper(substr(md5(random()::text), 1, 6)) WHERE id = future_open_team_2;

	INSERT INTO team_join_requests (id, team_id, player_id, accepted_at)
	VALUES (gen_random_uuid(), future_open_team_1, player_pool[1], now());
	INSERT INTO team_join_requests (id, team_id, player_id, accepted_at)
	VALUES (gen_random_uuid(), future_open_team_2, player_pool[2], NULL);

	-- A couple of free agents open for the active season's next upcoming
	-- week, one with a pending invite from a team.
	SELECT id INTO active_next_week_id FROM weeks WHERE season_id = v_active_id AND week_number = 4;
	SELECT id INTO active_team FROM teams WHERE season_id = v_active_id ORDER BY name LIMIT 1;

	availability_1 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_1, player_pool[3], active_next_week_id);
	availability_2 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_2, player_pool[4], active_next_week_id);

	INSERT INTO free_agent_invites (id, team_id, availability_id, accepted_at)
	VALUES (gen_random_uuid(), active_team, availability_1, NULL);
END;
$$;

COMMIT;
