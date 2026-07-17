import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hero com scroll-driven animation do livro (GSAP + ScrollTrigger).
 * A imagem `.book` faz scale/rotate/glow enquanto o usuário rola a página.
 */
const HeroScrollBook = () => {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!heroRef.current || !bookRef.current) return;

    // Respeita preferência de reduzir movimento
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current!,
          start: "top top",
          end: "+=1200",
          scrub: 1.5,
          pin: true,
        },
      });

      tl.from(bookRef.current, {
        scale: 0.4,
        opacity: 0,
        rotate: -40,
      })
        .to(bookRef.current, {
          scale: 1.3,
          rotate: 360,
          y: -40,
          filter:
            "drop-shadow(0 0 30px #00e5ff) drop-shadow(0 0 80px #b100ff)",
        })
        .to(bookRef.current, {
          scale: 0.9,
          y: 20,
          rotate: 390,
        });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="hero relative w-full h-screen flex items-center justify-center overflow-hidden"
      aria-label="Apresentação animada do livro"
    >
      <img
        ref={bookRef}
        src="/icon-512.png"
        alt="Livro AURA READ com brilho neon"
        className="book w-48 h-48 md:w-72 md:h-72 lg:w-96 lg:h-96 object-contain will-change-transform"
        draggable={false}
      />
    </section>
  );
};

export default HeroScrollBook;
