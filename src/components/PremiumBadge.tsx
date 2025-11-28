import { Crown, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumBadgeProps {
  variant?: "default" | "compact" | "icon-only";
  className?: string;
  icon?: "crown" | "lock" | "sparkles";
}

export const PremiumBadge = ({ 
  variant = "default", 
  className,
  icon = "crown" 
}: PremiumBadgeProps) => {
  const IconComponent = {
    crown: Crown,
    lock: Lock,
    sparkles: Sparkles
  }[icon];

  if (variant === "icon-only") {
    return (
      <IconComponent 
        className={cn(
          "w-4 h-4 text-amber-500 dark:text-amber-400",
          className
        )} 
      />
    );
  }

  if (variant === "compact") {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
        "text-amber-600 dark:text-amber-400",
        "border border-amber-500/30",
        className
      )}>
        <IconComponent className="w-3 h-3" />
        Premium
      </span>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold",
      "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
      "text-amber-600 dark:text-amber-400",
      "border border-amber-500/30",
      "shadow-sm",
      className
    )}>
      <IconComponent className="w-4 h-4" />
      Premium
    </span>
  );
};
