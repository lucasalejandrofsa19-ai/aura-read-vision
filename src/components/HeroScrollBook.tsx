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
      gsap
        .timeline({
          scrollTrigger: {
            trigger: document.body,
            start: "top top",
            end: "+=1200",
            scrub: 1.5,
          },
        })
        .from(".book", {
          scale: 0.4,
          opacity: 0,
          rotate: -40,
        })
        .to(".book", {
          scale: 1.3,
          rotate: 360,
          y: -40,
          filter:
            "drop-shadow(0 0 30px #00e5ff) drop-shadow(0 0 80px #b100ff)",
        })
        .to(".book", {
          scale: 0.9,
          y: 20,
          rotate: 390,
        });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="hero fixed inset-0 -z-10 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <img
        src={bookHero}
        alt=""
        className="book w-64 md:w-80 lg:w-96 h-auto will-change-transform opacity-70"
      />
    </div>
  );
};

export default HeroScrollBook;
