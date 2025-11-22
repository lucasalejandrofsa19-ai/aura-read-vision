import { useState } from "react";
import { useLazyImage } from "@/hooks/useLazyImage";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
  onLoad?: () => void;
}

export const LazyImage = ({ 
  src, 
  alt, 
  className, 
  containerClassName,
  placeholderClassName,
  onLoad 
}: LazyImageProps) => {
  const { imgRef, isVisible } = useLazyImage();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden", containerClassName)}>
      {/* Placeholder com skeleton loading */}
      {!isLoaded && !hasError && (
        <div 
          className={cn(
            "bg-gradient-to-br from-muted to-muted/50 animate-pulse",
            placeholderClassName || className
          )}
        />
      )}

      {/* Imagem real - só carrega quando visível */}
      {isVisible && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "transition-opacity duration-500",
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
          "bg-gradient-to-br from-red-500/10 to-red-600/10 flex items-center justify-center",
          placeholderClassName || className
        )}>
          <span className="text-xs text-muted-foreground">Erro ao carregar</span>
        </div>
      )}
    </div>
  );
};
