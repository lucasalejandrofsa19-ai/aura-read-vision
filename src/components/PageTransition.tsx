import { type ReactNode } from "react";
import { motion, type Transition, type Variants } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Available page-transition presets. All are GPU-accelerated
 * (transform / opacity only) to avoid layout thrash.
 */
export type PageTransitionVariant =
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "flip-x"
  | "flip-y";

export interface PageTransitionProps {
  children: ReactNode;
  /** Effect preset. Default: 'fade' (lightest, safest). */
  variant?: PageTransitionVariant;
  /** Duration in seconds. Default: 0.25. */
  duration?: number;
  /** Framer Motion easing. Default: [0.22, 1, 0.36, 1] (easeOutQuint). */
  ease?: Transition["ease"];
  /** Final opacity at rest. Default: 1. */
  opacity?: number;
  /** Optional className for the motion wrapper. */
  className?: string;
}

const STORAGE_DISABLED_KEY = "auraread:transitions-disabled";

const isDisabledViaStorage = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_DISABLED_KEY) === "1";
  } catch {
    return false;
  }
};

const buildVariants = (
  variant: PageTransitionVariant,
  restOpacity: number,
): Variants => {
  // All transforms use translate/scale/rotate — no width/height/top/left.
  switch (variant) {
    case "slide-left":
      return {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: restOpacity, x: 0 },
        exit: { opacity: 0, x: -24 },
      };
    case "slide-right":
      return {
        initial: { opacity: 0, x: -24 },
        animate: { opacity: restOpacity, x: 0 },
        exit: { opacity: 0, x: 24 },
      };
    case "slide-up":
      return {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: restOpacity, y: 0 },
        exit: { opacity: 0, y: -24 },
      };
    case "slide-down":
      return {
        initial: { opacity: 0, y: -24 },
        animate: { opacity: restOpacity, y: 0 },
        exit: { opacity: 0, y: 24 },
      };
    case "zoom-in":
      return {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: restOpacity, scale: 1 },
        exit: { opacity: 0, scale: 1.02 },
      };
    case "zoom-out":
      return {
        initial: { opacity: 0, scale: 1.04 },
        animate: { opacity: restOpacity, scale: 1 },
        exit: { opacity: 0, scale: 0.98 },
      };
    case "flip-x":
      return {
        initial: { opacity: 0, rotateX: -12 },
        animate: { opacity: restOpacity, rotateX: 0 },
        exit: { opacity: 0, rotateX: 12 },
      };
    case "flip-y":
      return {
        initial: { opacity: 0, rotateY: -12 },
        animate: { opacity: restOpacity, rotateY: 0 },
        exit: { opacity: 0, rotateY: 12 },
      };
    case "fade":
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: restOpacity },
        exit: { opacity: 0 },
      };
  }
};

/**
 * Wraps a route's content in a motion container that animates on
 * enter/exit. Place inside `<AnimatePresence mode="wait">` and key
 * the parent by `location.pathname` for route transitions.
 *
 * Accessibility & perf:
 *  - Returns plain children when `prefers-reduced-motion: reduce` is set.
 *  - Returns plain children when localStorage `auraread:transitions-disabled = '1'`.
 *  - Uses transform/opacity only → GPU-accelerated, no reflow.
 */
export const PageTransition = ({
  children,
  variant = "fade",
  duration = 0.25,
  ease = [0.22, 1, 0.36, 1],
  opacity = 1,
  className,
}: PageTransitionProps) => {
  const reducedMotion = usePrefersReducedMotion();
  const disabled = reducedMotion || isDisabledViaStorage();

  if (disabled) return <>{children}</>;

  const variants = buildVariants(variant, opacity);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration, ease }}
      style={{ willChange: "transform, opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
