import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const USER_PROFILE_SELECT =
  "full_name, avatar_url, theme_preference, has_seen_library_tour, has_seen_welcome, has_seen_reader_tour, ultra_performance_mode, zoom_sensitivity, sync_reading_enabled";

export const userProfileQueryKey = (userId: string) =>
  ["user-profile", userId] as const;

export const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select(USER_PROFILE_SELECT)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
};
