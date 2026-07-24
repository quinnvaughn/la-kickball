-- Fake dev data for the Cheviot Hills league, so frontend work (team
-- pages, schedules, box scores, career leaders, MVP awards, open-team
-- signups, free agents) has something real to render against.
--
-- Expects the base league + its three 2026 seasons to already exist
-- (winter-2026-coed, summer-2026-coed, fall-2026-mens under
-- cheviot-hills) — this only adds users/teams/games/stats on top.
--
-- Not meant to be re-run after editing by hand: each season block is
-- skipped if it already has teams, so running this twice in a row is
-- safe, but it won't "top up" partial data from a manually-tweaked DB.
--
-- Run with: pnpm db:seed

BEGIN;

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
	p_add_playoffs boolean,
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
	pairing int[];
	set_idx int;
	semi1_winner uuid;
	semi2_winner uuid;
	semi1_id uuid;
	semi2_id uuid;
	final_id uuid;
	final_winner uuid;
	v_idx1 int;
	v_idx2 int;
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
			pairing := pairing_sets[set_idx:set_idx];

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

	IF p_add_playoffs THEN
		-- Semifinals: teams[1] v teams[2], teams[3] v teams[4]
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
		semi1_winner := CASE WHEN home_score > away_score THEN team_ids[1] ELSE team_ids[2] END;
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
		semi2_winner := CASE WHEN home_score > away_score THEN team_ids[3] ELSE team_ids[4] END;
		PERFORM pg_temp.seed_game_logs(semi2_id, shuffled_players[(2 * p_roster_size + 1):(3 * p_roster_size)]);
		PERFORM pg_temp.seed_game_logs(semi2_id, shuffled_players[(3 * p_roster_size + 1):(4 * p_roster_size)]);

		-- Final
		week_id := gen_random_uuid();
		week_date := COALESCE(v_season.start_date, CURRENT_DATE) + ((p_total_weeks + 1) * 7);
		INSERT INTO weeks (id, season_id, week_number, date)
		VALUES (week_id, p_season_id, p_total_weeks + 2, week_date);

		ref_id := p_ref_pool[1 + floor(random() * array_length(p_ref_pool, 1))::int];
		LOOP
			home_score := 3 + floor(random() * 13)::int;
			away_score := 3 + floor(random() * 13)::int;
			EXIT WHEN home_score <> away_score;
		END LOOP;
		final_id := gen_random_uuid();
		INSERT INTO games (id, week_id, home_team_id, away_team_id, round, field, start_time, home_score, away_score, ref_id)
		VALUES (final_id, week_id, semi1_winner, semi2_winner, 'final', 'Field 1', v_season.start_time, home_score, away_score, ref_id);
		final_winner := CASE WHEN home_score > away_score THEN semi1_winner ELSE semi2_winner END;

		v_idx1 := array_position(team_ids, semi1_winner);
		v_idx2 := array_position(team_ids, semi2_winner);
		PERFORM pg_temp.seed_game_logs(final_id, shuffled_players[((v_idx1 - 1) * p_roster_size + 1):(v_idx1 * p_roster_size)]);
		PERFORM pg_temp.seed_game_logs(final_id, shuffled_players[((v_idx2 - 1) * p_roster_size + 1):(v_idx2 * p_roster_size)]);

		UPDATE seasons SET winner_id = final_winner WHERE id = p_season_id;

		FOR w IN 1..p_completed_weeks LOOP
			SELECT id INTO week_id FROM weeks WHERE season_id = p_season_id AND week_number = w;

			mvp_candidate := shuffled_players[1 + floor(random() * array_length(shuffled_players, 1))::int];
			INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
			VALUES (gen_random_uuid(), week_id, NULL, 'guy', mvp_candidate);

			mvp_candidate := shuffled_players[1 + floor(random() * array_length(shuffled_players, 1))::int];
			INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
			VALUES (gen_random_uuid(), week_id, NULL, 'girl', mvp_candidate);
		END LOOP;

		mvp_candidate := shuffled_players[1 + floor(random() * array_length(shuffled_players, 1))::int];
		INSERT INTO mvp_awards (id, week_id, season_id, category, user_id)
		VALUES (gen_random_uuid(), NULL, p_season_id, NULL, mvp_candidate);
	END IF;
END;
$fn$;

DO $$
DECLARE
	v_league_id uuid;
	v_winter_id uuid;
	v_summer_id uuid;
	v_fall_id uuid;

	first_names text[] := ARRAY['Alex','Jordan','Taylor','Morgan','Casey','Riley','Jamie','Cameron','Avery','Quinn','Drew','Reese','Rowan','Skyler','Dakota','Emerson','Finley','Hayden','Kendall','Peyton'];
	last_names text[] := ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Clark','Moore','Jackson','Martin','Lee'];
	winter_team_names text[] := ARRAY['Sole Purpose','Kicked Out','Punt Intended','Kick-Ass Krew'];
	summer_team_names text[] := ARRAY['The Base Invaders','Sneaker Squad','Rubber Ballers','The Diamond Divas'];
	fall_team_names text[] := ARRAY['Turf Wars','Home Run Kickers','Cleat Street','Grass Stains'];

	player_pool uuid[] := '{}';
	ref_pool uuid[] := '{}';

	i int;
	new_user_id uuid;

	fall_open_team_1 uuid;
	fall_open_team_2 uuid;
	summer_team uuid;
	summer_week5_id uuid;
	availability_1 uuid;
	availability_2 uuid;
BEGIN
	SELECT id INTO v_league_id FROM leagues WHERE slug = 'cheviot-hills';
	IF v_league_id IS NULL THEN
		RAISE EXCEPTION 'Expected a "cheviot-hills" league to already exist';
	END IF;

	SELECT id INTO v_winter_id FROM seasons WHERE league_id = v_league_id AND slug = 'winter-2026-coed';
	SELECT id INTO v_summer_id FROM seasons WHERE league_id = v_league_id AND slug = 'summer-2026-coed';
	SELECT id INTO v_fall_id FROM seasons WHERE league_id = v_league_id AND slug = 'fall-2026-mens';

	IF v_winter_id IS NULL OR v_summer_id IS NULL OR v_fall_id IS NULL THEN
		RAISE EXCEPTION 'Expected winter/summer/fall 2026 seasons to already exist under cheviot-hills';
	END IF;

	IF EXISTS (SELECT 1 FROM teams WHERE season_id IN (v_winter_id, v_summer_id, v_fall_id)) THEN
		RAISE NOTICE 'Seed already applied to these seasons — skipping';
		RETURN;
	END IF;

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

	-- Winter: fully played out, including playoffs, MVP awards, and a
	-- season winner — this is what makes the career-leaders query
	-- return real data.
	PERFORM pg_temp.seed_season(v_winter_id, 4, 10, 8, 8, true, winter_team_names, player_pool, ref_pool);

	-- Summer: in progress — weeks 1-4 played (today is partway through
	-- week 4), weeks 5-8 still upcoming.
	PERFORM pg_temp.seed_season(v_summer_id, 4, 10, 8, 4, false, summer_team_names, player_pool, ref_pool);

	-- Fall: rosters formed, nothing scheduled yet (season hasn't started).
	PERFORM pg_temp.seed_season(v_fall_id, 4, 10, 0, 0, false, fall_team_names, player_pool, ref_pool);

	-- A couple of open fall teams + join requests, so the "still
	-- recruiting" team state has something to look at.
	SELECT id INTO fall_open_team_1 FROM teams WHERE season_id = v_fall_id ORDER BY name LIMIT 1;
	SELECT id INTO fall_open_team_2 FROM teams WHERE season_id = v_fall_id ORDER BY name OFFSET 1 LIMIT 1;

	UPDATE teams SET is_open = true, invite_code = upper(substr(md5(random()::text), 1, 6)) WHERE id = fall_open_team_1;
	UPDATE teams SET is_open = true, invite_code = upper(substr(md5(random()::text), 1, 6)) WHERE id = fall_open_team_2;

	INSERT INTO team_join_requests (id, team_id, player_id, accepted_at)
	VALUES (gen_random_uuid(), fall_open_team_1, player_pool[1], now());
	INSERT INTO team_join_requests (id, team_id, player_id, accepted_at)
	VALUES (gen_random_uuid(), fall_open_team_2, player_pool[2], NULL);

	-- A couple of free agents open for an upcoming summer week, one
	-- with a pending invite from a team.
	SELECT id INTO summer_week5_id FROM weeks WHERE season_id = v_summer_id AND week_number = 5;
	SELECT id INTO summer_team FROM teams WHERE season_id = v_summer_id ORDER BY name LIMIT 1;

	availability_1 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_1, player_pool[3], summer_week5_id);
	availability_2 := gen_random_uuid();
	INSERT INTO free_agent_availability (id, user_id, week_id) VALUES (availability_2, player_pool[4], summer_week5_id);

	INSERT INTO free_agent_invites (id, team_id, availability_id, accepted_at)
	VALUES (gen_random_uuid(), summer_team, availability_1, NULL);
END;
$$;

COMMIT;
