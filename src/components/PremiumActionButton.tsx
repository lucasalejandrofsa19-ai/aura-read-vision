import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserData } from "@/hooks/useUserData";
import { PremiumBadge } from "@/components/PremiumBadge";

interface PremiumActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  requiresPremium?: boolean;
  active?: boolean;
  className?: string;
}

export const PremiumActionButton = ({
  icon,
  label,
  onClick,
  requiresPremium = false,
  active = false,
  className = "",
}: PremiumActionButtonProps) => {
  const navigate = useNavigate();
  const { hasPremiumAccess } = useUserData();

  const handleClick = () => {
    if (requiresPremium && !hasPremiumAccess) {
      toast.error("Recurso disponível apenas para assinantes Premium/Pro", {
        action: {
          label: "Ver Planos",
          onClick: () => navigate("/pricing"),
        },
      });
      return;
    }
    onClick?.();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-block">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClick}
              className={`relative transition-all ${
                active ? "text-accent aura-amber" : "aura-soft"
              } ${className}`}
            >
              {icon}
              <span className="hidden sm:inline ml-2 text-xs">{label}</span>
            </Button>
            {requiresPremium && !hasPremiumAccess && (
              <div className="absolute -top-1 -right-1">
                <PremiumBadge variant="icon-only" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
          {requiresPremium && !hasPremiumAccess && (
            <p className="text-xs text-purple-400 mt-1">Requer Premium/Pro</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
