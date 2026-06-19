import { useStoryVideoQuota } from "@/hooks/useStoryVideoQuota";

export function StoryVideoQuotaBadge({ className = "" }: { className?: string }) {
  const { data } = useStoryVideoQuota();

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
