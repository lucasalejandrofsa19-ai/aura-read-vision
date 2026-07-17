import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Camada de fundo com o livro animado por scroll (GSAP + ScrollTrigger).
 * Fica fixa atrás do conteúdo, sem interceptar cliques. Parâmetros
 * ajustados para desktop e mobile.
 */
const HeroScrollBook = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || !bookRef.current) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Desktop / tablet grande
      mm.add("(min-width: 768px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: document.body,
            start: "top top",
            end: "+=1200",
            scrub: 1.5,
            invalidateOnRefresh: true,
          },
        });
        tl.from(bookRef.current, { scale: 0.4, opacity: 0, rotate: -40 })
          .to(bookRef.current, {
            scale: 1.3,
            rotate: 360,
            y: -40,
            filter:
              "drop-shadow(0 0 30px #00e5ff) drop-shadow(0 0 80px #b100ff)",
          })
          .to(bookRef.current, { scale: 0.9, y: 20, rotate: 390 });
      });

      // Mobile: distância menor, scrub mais rápido, escalas moderadas
      mm.add("(max-width: 767px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: document.body,
            start: "top top",
            end: "+=600",
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
        tl.from(bookRef.current, { scale: 0.6, opacity: 0, rotate: -20 })
          .to(bookRef.current, {
            scale: 1.05,
            rotate: 180,
            y: -20,
            filter:
              "drop-shadow(0 0 14px #00e5ff) drop-shadow(0 0 40px #b100ff)",
          })
          .to(bookRef.current, { scale: 0.85, y: 10, rotate: 200 });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <img
        ref={bookRef}
        src="/icon-512.png"
        alt=""
        className="book w-56 h-56 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] object-contain opacity-70 md:opacity-60 will-change-transform"
        draggable={false}
      />
    </div>
  );
};

export default HeroScrollBook;
