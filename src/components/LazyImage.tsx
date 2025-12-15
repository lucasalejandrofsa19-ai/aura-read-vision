import { useState, useMemo } from "react";
import { useLazyImage } from "@/hooks/useLazyImage";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
  onLoad?: () => void;
  blurPlaceholder?: boolean;
}

export const LazyImage = ({ 
  src, 
  alt, 
  className, 
  containerClassName,
  placeholderClassName,
  onLoad,
  blurPlaceholder = true
}: LazyImageProps) => {
  const { imgRef, isVisible } = useLazyImage();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Generate a low-quality blur placeholder using canvas
  const blurDataUrl = useMemo(() => {
    if (!blurPlaceholder) return null;
    // Create a tiny colored placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 6;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Create a gradient for visual interest
      const gradient = ctx.createLinearGradient(0, 0, 4, 6);
      gradient.addColorStop(0, 'hsl(220, 15%, 25%)');
      gradient.addColorStop(1, 'hsl(220, 15%, 15%)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 4, 6);
    }
    return canvas.toDataURL('image/jpeg', 0.1);
  }, [blurPlaceholder]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden", containerClassName)}>
      {/* Blur placeholder */}
      {!isLoaded && !hasError && blurPlaceholder && blurDataUrl && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 w-full h-full object-cover scale-110 blur-xl",
            placeholderClassName || className
          )}
        />
      )}

      {/* Skeleton loading overlay */}
      {!isLoaded && !hasError && (
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-muted/50 to-muted/30",
            !blurPlaceholder && "animate-pulse",
            placeholderClassName
          )}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        </div>
      )}

      {/* Imagem real - só carrega quando visível */}
      {isVisible && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}

      {/* Fallback se houver erro */}
      {hasError && (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/10 flex items-center justify-center",
          placeholderClassName || className
        )}>
          <span className="text-xs text-muted-foreground">Erro</span>
        </div>
      )}
    </div>
  );
};
