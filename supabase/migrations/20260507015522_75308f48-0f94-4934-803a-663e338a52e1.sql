
-- Gamification System: stats, daily progress, achievements

-- 1. gamification_stats
CREATE TABLE public.gamification_stats (
  user_id uuid PRIMARY KEY,
  xp_total integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  daily_goal_pages integer NOT NULL DEFAULT 10,
  freezes_available integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gamification_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stats" ON public.gamification_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own stats" ON public.gamification_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own stats" ON public.gamification_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_gamification_stats_updated BEFORE UPDATE ON public.gamification_stats
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. daily_progress
CREATE TABLE public.daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT current_date,
  pages_read integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  goal_met boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own daily progress" ON public.daily_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own daily progress" ON public.daily_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own daily progress" ON public.daily_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_daily_progress_updated BEFORE UPDATE ON public.daily_progress
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_daily_progress_user_date ON public.daily_progress(user_id, date DESC);

-- 3. achievements catalog
CREATE TABLE public.achievements (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  xp_reward integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view achievements" ON public.achievements FOR SELECT TO authenticated USING (true);

INSERT INTO public.achievements (code, name, description, icon, requirement_type, requirement_value, xp_reward, sort_order) VALUES
  ('first_page', 'Primeira Página', 'Leia sua primeira página', 'book-open', 'total_pages', 1, 10, 1),
  ('reader_10', 'Leitor Iniciante', 'Leia 10 páginas no total', 'book', 'total_pages', 10, 25, 2),
  ('reader_100', 'Leitor Dedicado', 'Leia 100 páginas no total', 'library', 'total_pages', 100, 100, 3),
  ('reader_1000', 'Bibliófilo', 'Leia 1000 páginas no total', 'library-big', 'total_pages', 1000, 500, 4),
  ('streak_3', 'Em Chamas', 'Mantenha 3 dias seguidos de leitura', 'flame', 'streak', 3, 30, 10),
  ('streak_7', 'Semana Perfeita', 'Mantenha 7 dias seguidos de leitura', 'flame', 'streak', 7, 75, 11),
  ('streak_30', 'Hábito Forjado', 'Mantenha 30 dias seguidos de leitura', 'flame', 'streak', 30, 300, 12),
  ('streak_100', 'Lendário', '100 dias seguidos de leitura', 'crown', 'streak', 100, 1000, 13),
  ('goal_first', 'Meta Cumprida', 'Bata sua meta diária pela primeira vez', 'target', 'goals_met', 1, 20, 20),
  ('goal_10', 'Comprometido', 'Bata sua meta diária 10 vezes', 'target', 'goals_met', 10, 100, 21),
  ('goal_50', 'Disciplinado', 'Bata sua meta diária 50 vezes', 'target', 'goals_met', 50, 500, 22),
  ('xp_500', 'Aprendiz', 'Acumule 500 XP', 'star', 'xp', 500, 0, 30),
  ('xp_2000', 'Veterano', 'Acumule 2000 XP', 'star', 'xp', 2000, 0, 31),
  ('xp_5000', 'Mestre', 'Acumule 5000 XP', 'sparkles', 'xp', 5000, 0, 32);

-- 4. user_achievements
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_code text NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_code)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own achievements" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);

-- 5. Helper: compute level from XP
CREATE OR REPLACE FUNCTION public.compute_level(xp integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT GREATEST(1, FLOOR(SQRT(GREATEST(xp,0)::numeric / 50.0))::integer + 1);
$$;

-- 6. Check achievements for a user
CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp integer;
  v_streak integer;
  v_total_pages integer;
  v_goals_met integer;
  ach record;
  v_qualifies boolean;
  v_bonus integer := 0;
BEGIN
  SELECT xp_total, current_streak INTO v_xp, v_streak FROM public.gamification_stats WHERE user_id = _user_id;
  SELECT COALESCE(SUM(pages_read),0) INTO v_total_pages FROM public.daily_progress WHERE user_id = _user_id;
  SELECT COUNT(*) INTO v_goals_met FROM public.daily_progress WHERE user_id = _user_id AND goal_met = true;

  FOR ach IN SELECT * FROM public.achievements LOOP
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = _user_id AND achievement_code = ach.code) THEN
      CONTINUE;
    END IF;
    v_qualifies := false;
    IF ach.requirement_type = 'xp' AND v_xp >= ach.requirement_value THEN v_qualifies := true;
    ELSIF ach.requirement_type = 'streak' AND v_streak >= ach.requirement_value THEN v_qualifies := true;
    ELSIF ach.requirement_type = 'total_pages' AND v_total_pages >= ach.requirement_value THEN v_qualifies := true;
    ELSIF ach.requirement_type = 'goals_met' AND v_goals_met >= ach.requirement_value THEN v_qualifies := true;
    END IF;

    IF v_qualifies THEN
      INSERT INTO public.user_achievements (user_id, achievement_code) VALUES (_user_id, ach.code) ON CONFLICT DO NOTHING;
      v_bonus := v_bonus + ach.xp_reward;
    END IF;
  END LOOP;

  IF v_bonus > 0 THEN
    UPDATE public.gamification_stats
    SET xp_total = xp_total + v_bonus,
        level = public.compute_level(xp_total + v_bonus)
    WHERE user_id = _user_id;
  END IF;
END;
$$;

-- 7. Main entrypoint: register pages read
CREATE OR REPLACE FUNCTION public.register_pages_read(_pages integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  v_goal integer;
  v_today date := current_date;
  v_existing public.daily_progress%ROWTYPE;
  v_was_goal_met boolean := false;
  v_now_goal_met boolean := false;
  v_xp_gain integer := 0;
  v_streak integer;
  v_last date;
  v_new_streak integer;
  v_leveled_up boolean := false;
  v_old_level integer;
  v_new_level integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _pages <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_pages');
  END IF;

  -- Ensure stats row
  INSERT INTO public.gamification_stats (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT daily_goal_pages, current_streak, last_activity_date, level
    INTO v_goal, v_streak, v_last, v_old_level
    FROM public.gamification_stats WHERE user_id = _user_id;

  v_xp_gain := _pages; -- 1 XP per page

  -- Upsert daily_progress
  SELECT * INTO v_existing FROM public.daily_progress WHERE user_id = _user_id AND date = v_today;
  IF v_existing.id IS NULL THEN
    INSERT INTO public.daily_progress (user_id, date, pages_read, xp_earned, goal_met)
    VALUES (_user_id, v_today, _pages, v_xp_gain, _pages >= v_goal)
    RETURNING * INTO v_existing;
  ELSE
    v_was_goal_met := v_existing.goal_met;
    UPDATE public.daily_progress
      SET pages_read = pages_read + _pages,
          xp_earned = xp_earned + v_xp_gain,
          goal_met = (pages_read + _pages) >= v_goal
      WHERE id = v_existing.id
      RETURNING * INTO v_existing;
  END IF;
  v_now_goal_met := v_existing.goal_met;

  -- Goal bonus
  IF v_now_goal_met AND NOT v_was_goal_met THEN
    v_xp_gain := v_xp_gain + 25;
    UPDATE public.daily_progress SET xp_earned = xp_earned + 25 WHERE id = v_existing.id;

    -- Update streak
    IF v_last IS NULL OR v_last < v_today - INTERVAL '1 day' THEN
      v_new_streak := 1;
    ELSIF v_last = v_today - INTERVAL '1 day' THEN
      v_new_streak := COALESCE(v_streak,0) + 1;
    ELSE
      v_new_streak := COALESCE(v_streak,0); -- same day already counted somehow
      IF v_new_streak = 0 THEN v_new_streak := 1; END IF;
    END IF;

    UPDATE public.gamification_stats
      SET current_streak = v_new_streak,
          longest_streak = GREATEST(longest_streak, v_new_streak),
          last_activity_date = v_today
      WHERE user_id = _user_id;
  END IF;

  -- Award XP
  UPDATE public.gamification_stats
    SET xp_total = xp_total + v_xp_gain,
        level = public.compute_level(xp_total + v_xp_gain)
    WHERE user_id = _user_id
    RETURNING level INTO v_new_level;

  v_leveled_up := v_new_level > COALESCE(v_old_level,1);

  -- Check achievements
  PERFORM public.check_achievements(_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'xp_gained', v_xp_gain,
    'goal_met_now', v_now_goal_met AND NOT v_was_goal_met,
    'leveled_up', v_leveled_up,
    'new_level', v_new_level
  );
END;
$$;

-- 8. Award XP for arbitrary actions (e.g., highlight)
CREATE OR REPLACE FUNCTION public.award_action_xp(_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  v_amount integer := 0;
  v_old_level integer;
  v_new_level integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_amount := CASE _action
    WHEN 'highlight' THEN 10
    WHEN 'note' THEN 5
    WHEN 'book_completed' THEN 50
    ELSE 0 END;
  IF v_amount = 0 THEN RETURN jsonb_build_object('ok', false); END IF;

  INSERT INTO public.gamification_stats (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT level INTO v_old_level FROM public.gamification_stats WHERE user_id = _user_id;

  UPDATE public.gamification_stats
    SET xp_total = xp_total + v_amount,
        level = public.compute_level(xp_total + v_amount)
    WHERE user_id = _user_id
    RETURNING level INTO v_new_level;

  -- Add to today's xp
  INSERT INTO public.daily_progress (user_id, date, xp_earned)
    VALUES (_user_id, current_date, v_amount)
    ON CONFLICT (user_id, date) DO UPDATE SET xp_earned = public.daily_progress.xp_earned + v_amount;

  PERFORM public.check_achievements(_user_id);
  RETURN jsonb_build_object('ok', true, 'xp_gained', v_amount, 'leveled_up', v_new_level > v_old_level, 'new_level', v_new_level);
END;
$$;

-- 9. Set daily goal
CREATE OR REPLACE FUNCTION public.set_daily_goal(_pages integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pages < 1 OR _pages > 500 THEN RAISE EXCEPTION 'Invalid goal'; END IF;
  INSERT INTO public.gamification_stats (user_id, daily_goal_pages) VALUES (_user_id, _pages)
    ON CONFLICT (user_id) DO UPDATE SET daily_goal_pages = _pages;
END;
$$;

-- Permissions
REVOKE EXECUTE ON FUNCTION public.register_pages_read(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_pages_read(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.award_action_xp(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_action_xp(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_daily_goal(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_daily_goal(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO authenticated, service_role;
