CREATE OR REPLACE FUNCTION public.can_generate_story_video(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_premium boolean;
  v_used integer;
  v_limit integer := 3;
BEGIN
  v_premium := public.has_premium_access(_user_id);
  SELECT COUNT(*) INTO v_used FROM public.story_videos
    WHERE user_id = _user_id
      AND created_at >= date_trunc('day', now());
  IF v_premium THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', -1, 'premium', true);
  END IF;
  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'limit', v_limit,
    'premium', false
  );
END;
$function$;