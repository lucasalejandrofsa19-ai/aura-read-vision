import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolHelpTooltipProps {
  title: string;
  description: string;
  /** Anchor on the Guide page, e.g. "Marcação de texto" */
  guideAnchor?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}

/**
 * Wraps a tool trigger (button, etc.) with a contextual tooltip:
 * - Short title
 * - Description of what the tool does
 * - Link back to the full Guide page (/guia)
 */
export const ToolHelpTooltip = ({
  title,
  description,
  guideAnchor,
  side = "bottom",
  children,
}: ToolHelpTooltipProps) => {
  const guideHref = guideAnchor
    ? `/guia#${encodeURIComponent(guideAnchor)}`
    : "/guia";

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
          <Link
            to={guideHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <HelpCircle className="w-3 h-3" />
            Saiba mais no Guia
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
