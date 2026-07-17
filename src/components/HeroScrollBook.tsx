import { useEffect, useRef } from "react";
import bookHero from "@/assets/book-hero.png";

const HeroScrollBook = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rootRef.current) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let cancelled = false;
    // Guarda os ScrollTriggers criados por este componente para cleanup dirigido.
    const createdTriggers: Array<{ kill: () => void }> = [];
    let ctxCleanup: (() => void) | null = null;

    (async () => {
      try {
        const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled || !rootRef.current) return;

        // Registro idempotente
        gsap.registerPlugin(ScrollTrigger);

        if (reduceMotion) {
          gsap.set(".book", {
            scale: 1,
            rotate: 0,
            y: 0,
            opacity: 1,
            filter: "drop-shadow(0 0 20px #00e5ff)",
          });
          return;
        }

        // Ativar markers via ?markers=1 ou localStorage `hero:markers` = "1"
        const showMarkers =
          new URLSearchParams(window.location.search).get("markers") === "1" ||
          localStorage.getItem("hero:markers") === "1";
        if (showMarkers) {
          // eslint-disable-next-line no-console
          console.info("[HeroScrollBook] ScrollTrigger markers habilitados");
        }

        const ctx = gsap.context(() => {
          // `.hero` é position:fixed → não serve como trigger.
          // Usamos o body como referência para o scroll global da página.
          const bodyTrigger = document.body;

          const tl = gsap
            .timeline({
              scrollTrigger: {
                trigger: bodyTrigger,
                start: "top top",
                end: "+=1200",
                scrub: 1.5,
                markers: showMarkers && { startColor: "#00e5ff", endColor: "#b100ff", indent: 20 },
              },
            })
            .from(".book", { scale: 0.4, opacity: 0, rotate: -40 })
            .to(".book", {
              scale: 1.3,
              rotate: 360,
              y: -40,
              filter:
                "drop-shadow(0 0 30px #00e5ff) drop-shadow(0 0 80px #b100ff)",
            })
            .to(".book", { scale: 0.9, y: 20, rotate: 390 });
          if (tl.scrollTrigger) createdTriggers.push(tl.scrollTrigger);

          const parallax = [
            {
              sel: ".bg-logo",
              vars: {
                y: -300,
                rotate: 40,
                scale: 1.4,
                scrollTrigger: {
                  trigger: bodyTrigger,
                  start: "top top",
                  end: "+=1500",
                  scrub: true,
                },
              },
            },
            {
              sel: ".glow1",
              vars: {
                y: -200,
                x: -100,
                scrollTrigger: {
                  trigger: bodyTrigger,
                  start: "top top",
                  end: "+=1500",
                  scrub: true,
                },
              },
            },
            {
              sel: ".glow2",
              vars: {
                y: 150,
                x: 120,
                scrollTrigger: {
                  trigger: bodyTrigger,
                  start: "top top",
                  end: "+=1500",
                  scrub: true,
                },
              },
            },
            {
              sel: ".glow3",
              vars: {
                rotate: -30,
                scale: 1.5,
                scrollTrigger: {
                  trigger: bodyTrigger,
                  start: "top top",
                  end: "+=1500",
                  scrub: true,
                },
              },
            },
          ];



          parallax.forEach(({ sel, vars }) => {
            const tween = gsap.to(sel, vars);
            const st = (tween as unknown as { scrollTrigger?: { kill: () => void } })
              .scrollTrigger;
            if (st) createdTriggers.push(st);
          });

          // Flutuação contínua (não usa ScrollTrigger)
          gsap.to(".bg-logo", {
            y: "+=25",
            duration: 4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        }, rootRef);

        ctxCleanup = () => ctx.revert();
      } catch (err) {
        console.warn("[HeroScrollBook] Falha ao carregar GSAP:", err);
      }
    })();

    return () => {
      cancelled = true;
      // Mata ScrollTriggers criados aqui.
      createdTriggers.forEach((st) => {
        try {
          st.kill();
        } catch {
          /* noop */
        }
      });
      // Reverte tweens/estilos aplicados pelo contexto do GSAP.
      if (ctxCleanup) ctxCleanup();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="hero fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
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

      <img
        src={bookHero}
        alt=""
        className="bg-logo absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[80vw] opacity-20 will-change-transform"
      />

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
