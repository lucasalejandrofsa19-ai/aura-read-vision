import { useEffect, useRef, useState } from "react";

interface UseLazyImageOptions {
  threshold?: number;
  rootMargin?: string;
}

export const useLazyImage = (options: UseLazyImageOptions = {}) => {
  const { threshold = 0.1, rootMargin = "50px" } = options;
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, rootMargin]);

  return { imgRef, isVisible };
};
