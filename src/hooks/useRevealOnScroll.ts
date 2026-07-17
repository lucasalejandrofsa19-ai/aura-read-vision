import { useEffect } from "react";

/**
 * useRevealOnScroll
 *
 * Observa todos os elementos com a classe `.reveal-on-scroll` e adiciona
 * `.is-visible` quando entram na viewport, disparando a animação CSS.
 *
 * - Usa IntersectionObserver (performático, sem listeners de scroll).
 * - Reobserva o DOM quando novas seções aparecem (rotas, lazy render).
 * - Respeita `prefers-reduced-motion`: revela tudo imediatamente sem animar.
 * - Uma única observação por elemento (unobserve após revelar).
 */
export function useRevealOnScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Fallback: sem IntersectionObserver ou motion reduzido → revela tudo.
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      document
        .querySelectorAll<HTMLElement>(".reveal-on-scroll")
        .forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        root: null,
        // Antecipa levemente a entrada para o efeito parecer mais natural.
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.12,
      }
    );

    const observeAll = () => {
      document
        .querySelectorAll<HTMLElement>(".reveal-on-scroll:not(.is-visible)")
        .forEach((el) => observer.observe(el));
    };

    observeAll();

    // Reobserva sempre que o DOM mudar (mudança de rota, lazy content).
    const mutation = new MutationObserver(() => observeAll());
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutation.disconnect();
      observer.disconnect();
    };
  }, []);
}
