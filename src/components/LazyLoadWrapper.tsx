import { ReactNode } from "react";
import { useLazyLoad } from "@/hooks/useLazyLoad";
import { Skeleton } from "@/components/ui/skeleton";

interface LazyLoadWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
  minHeight?: string;
}

export const LazyLoadWrapper = ({
  children,
  fallback,
  rootMargin = "100px",
  threshold = 0.01,
  minHeight = "200px",
}: LazyLoadWrapperProps) => {
  const { elementRef, isVisible } = useLazyLoad({
    rootMargin,
    threshold,
    triggerOnce: true,
  });

  return (
    <div ref={elementRef} style={{ minHeight: isVisible ? undefined : minHeight }}>
      {isVisible ? (
        children
      ) : (
        fallback || (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )
      )}
    </div>
  );
};
