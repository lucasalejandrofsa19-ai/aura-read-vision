import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type TourTargetsMap = Map<string, HTMLElement>;

interface TourTargetsContextValue {
  register: (id: string, el: HTMLElement | null) => void;
  getTarget: (id: string) => HTMLElement | undefined;
}

const TourTargetsContext = createContext<TourTargetsContextValue | null>(null);

export const TourTargetsProvider = ({ children }: { children: ReactNode }) => {
  const targetsRef = useRef<TourTargetsMap>(new Map());

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) targetsRef.current.set(id, el);
    else targetsRef.current.delete(id);
  }, []);

  const getTarget = useCallback((id: string) => targetsRef.current.get(id), []);

  const value = useMemo(() => ({ register, getTarget }), [register, getTarget]);

  return <TourTargetsContext.Provider value={value}>{children}</TourTargetsContext.Provider>;
};

/** Ref callback que registra/desregistra um elemento como alvo do tour. */
export const useTourTarget = (id: string) => {
  const ctx = useContext(TourTargetsContext);
  return useCallback(
    (el: HTMLElement | null) => {
      ctx?.register(id, el);
    },
    [ctx, id]
  );
};

export const useTourTargets = () => {
  const ctx = useContext(TourTargetsContext);
  if (!ctx) throw new Error("useTourTargets must be used inside <TourTargetsProvider>");
  return ctx;
};
