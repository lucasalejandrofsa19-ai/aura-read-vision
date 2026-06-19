import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Quota = { allowed: boolean; used: number; limit: number; premium: boolean };

export function StoryVideoQuotaBadge({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["story-video-quota", user?.id],
    queryFn: async (): Promise<Quota | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("can_generate_story_video", { _user_id: user.id });
      if (error) return null;
      return data as unknown as Quota;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (!data || data.premium) return null;
  return (
    <span
      title={data.allowed ? "Vídeos restantes este mês" : "Limite mensal atingido"}
      className={`inline-flex items-center justify-center rounded-md border border-border/40 bg-background/70 px-1.5 text-[10px] font-semibold leading-none backdrop-blur-md h-7 ${
        data.allowed ? "text-foreground" : "text-destructive border-destructive/40"
      } ${className}`}
    >
      {Math.max(0, data.limit - data.used)}/{data.limit}
    </span>
  );
}
