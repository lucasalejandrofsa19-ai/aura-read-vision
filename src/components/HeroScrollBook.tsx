import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import bookHero from "@/assets/book-hero.png";

gsap.registerPlugin(ScrollTrigger);

const HeroScrollBook = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;

    const ctx = gsap.context(() => {
      // Timeline principal do livro (.book)
      gsap
        .timeline({
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "+=1200",
            scrub: 1.5,
          },
        })
        .from(".book", { scale: 0.4, opacity: 0, rotate: -40 })
        .to(".book", {
          scale: 1.3,
          rotate: 360,
          y: -40,
          filter: "drop-shadow(0 0 30px #00e5ff) drop-shadow(0 0 80px #b100ff)",
        })
        .to(".book", { scale: 0.9, y: 20, rotate: 390 });

      // Parallax do logo de fundo
      gsap.to(".bg-logo", {
        y: -300,
        rotate: 40,
        scale: 1.4,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Glows
      gsap.to(".glow1", {
        y: -200,
        x: -100,
        scrollTrigger: { trigger: ".hero", scrub: true },
      });
      gsap.to(".glow2", {
        y: 150,
        x: 120,
        scrollTrigger: { trigger: ".hero", scrub: true },
      });
      gsap.to(".glow3", {
        rotate: -30,
        scale: 1.5,
        scrollTrigger: { trigger: ".hero", scrub: true },
      });

      // Flutuação contínua do bg-logo
      gsap.to(".bg-logo", {
        y: "+=25",
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="hero fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      {/* Glows neon */}
      <div
        className="glow1 absolute top-[10%] left-[15%] w-[420px] h-[420px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #00e5ff 0%, transparent 70%)" }}
      />
      <div
        className="glow2 absolute bottom-[10%] right-[10%] w-[520px] h-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #b100ff 0%, transparent 70%)" }}
      />
      <div
        className="glow3 absolute top-[40%] left-[50%] w-[380px] h-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #ff2ea6 0%, transparent 70%)" }}
      />

      {/* Logo/livro parallax de fundo */}
      <img
        src={bookHero}
        alt=""
        className="bg-logo absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[80vw] opacity-20 will-change-transform"
      />

      {/* Livro em destaque (timeline principal) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={bookHero}
          alt=""
          className="book w-64 md:w-80 lg:w-96 h-auto opacity-70 will-change-transform"
        />
      </div>
    </div>
  );
};

export default HeroScrollBook;
