import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type StoryVideoQuota = {
  allowed: boolean;
  used: number;
  limit: number;
  premium: boolean;
};

export function useStoryVideoQuota() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["story-video-quota", user?.id],
    queryFn: async (): Promise<StoryVideoQuota | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("can_generate_story_video", {
        _user_id: user.id,
      });
      if (error) return null;
      return data as unknown as StoryVideoQuota;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
