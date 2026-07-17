import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import neonBookDesktop from "@/assets/neon-book-hero.webp.asset.json";
import neonBookMobile from "@/assets/neon-book-hero-mobile.webp.asset.json";
import { useTheme, type ThemeType } from "@/contexts/ThemeContext";

// Paleta de glow + tint do livro por tema (sincronizado com o leitor).
// safira = Safira translúcido | sepia = Papel velho digital
// noturno = Grafite escuro     | contraste = Âmbar quente
const THEME_ATMOSPHERE: Record<
  ThemeType,
  { glowA: string; glowB: string; tint: [number, number, number]; intensity: number }
> = {
  safira:    { glowA: "#00e5ff", glowB: "#b100ff", tint: [1.0, 1.0, 1.0], intensity: 1.0 },
  sepia:     { glowA: "#d4a373", glowB: "#f2c98a", tint: [1.15, 0.95, 0.72], intensity: 0.9 },
  noturno:   { glowA: "#4a5cff", glowB: "#2a2f4a", tint: [0.75, 0.8, 1.05], intensity: 0.85 },
  contraste: { glowA: "#ffb347", glowB: "#ff7a00", tint: [1.2, 0.9, 0.55], intensity: 1.1 },
};

// Curva de easing consistente para transições CSS de glow entre temas.
const THEME_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"; // ease-out-quint
const THEME_DURATION_MS = 900;

/**
 * Plano de fundo 3D otimizado para mobile:
 * - `prefers-reduced-motion` -> frameloop `demand` (praticamente parado)
 * - Aba/visibilidade oculta -> pausa completa (frameloop `demand`)
 * - FPS cap adaptativo (30 em mobile/low-end, 60 em desktop)
 * - Save-Data / bateria fraca -> asset mobile + FPS ainda menor
 * - Asset WebP (28 KB mobile / 87 KB desktop), lazy via Suspense
 */

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
};

const detectWebGL = (): boolean => {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
};

const useDeviceProfile = () => {
  const [profile, setProfile] = useState({
    isMobile: false,
    lowEnd: false,
    veryLowEnd: false,
    saveData: false,
    hasWebGL: true,
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasWebGL = detectWebGL();
    const compute = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const cores = navigator.hardwareConcurrency ?? 8;
      // @ts-expect-error deviceMemory não é padrão em todos os TS libs
      const mem: number | undefined = navigator.deviceMemory;
      const lowEnd = cores <= 4 || (typeof mem === "number" && mem <= 4);
      const veryLowEnd = cores <= 2 || (typeof mem === "number" && mem <= 2);
      // @ts-expect-error connection não tipado em todos os libs
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const saveData = !!conn?.saveData || ["slow-2g", "2g", "3g"].includes(conn?.effectiveType);
      setProfile({ isMobile, lowEnd, veryLowEnd, saveData, hasWebGL });
    };
    compute();
    const mq = window.matchMedia("(max-width: 768px)");
    mq.addEventListener?.("change", compute);
    // @ts-expect-error connection.change
    const conn = navigator.connection;
    conn?.addEventListener?.("change", compute);
    return () => {
      mq.removeEventListener?.("change", compute);
      conn?.removeEventListener?.("change", compute);
    };
  }, []);
  return profile;
};

/** Preferência manual (URL/localStorage) para forçar o modo estático. */
const useForceStatic = () => {
  const [forced, setForced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("static") === "1") {
        localStorage.setItem("hero3d:static", "1");
      } else if (params.get("static") === "0") {
        localStorage.removeItem("hero3d:static");
      }
      setForced(localStorage.getItem("hero3d:static") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  return forced;
};


/** Pausa o Canvas quando a aba está oculta. Retorna se está visível. */
const usePageVisible = () => {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
};

/** Detecta bateria fraca (< 20% descarregando) para reduzir custo ainda mais. */
const useLowBattery = () => {
  const [low, setLow] = useState(false);
  useEffect(() => {
    // @ts-expect-error getBattery é experimental
    if (typeof navigator === "undefined" || !navigator.getBattery) return;
    let battery: any;
    let mounted = true;
    const update = () => {
      if (!mounted || !battery) return;
      setLow(battery.charging === false && battery.level < 0.2);
    };
    // @ts-expect-error getBattery
    navigator.getBattery().then((b: any) => {
      battery = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    }).catch(() => {});
    return () => {
      mounted = false;
      battery?.removeEventListener?.("levelchange", update);
      battery?.removeEventListener?.("chargingchange", update);
    };
  }, []);
  return low;
};

const FloatingBookMesh = ({
  reduced,
  isMobile,
  tint,
  intensity,
  fpsCap,
  assetUrl,
}: {
  reduced: boolean;
  isMobile: boolean;
  tint: [number, number, number];
  intensity: number;
  fpsCap: number;
  assetUrl: string;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.AmbientLight>(null);
  const texture = useLoader(THREE.TextureLoader, assetUrl);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = isMobile ? 2 : 4;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
  }, [texture, isMobile]);

  // Libera a textura da GPU ao desmontar.
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const targetTint = useMemo(
    () => new THREE.Color(tint[0], tint[1], tint[2]),
    [tint[0], tint[1], tint[2]]
  );
  const currentTintRef = useRef(new THREE.Color(tint[0], tint[1], tint[2]));

  // Acumulador de tempo para FPS cap (mobile/low-end -> 30fps).
  const frameAccum = useRef(0);
  const minFrameTime = 1 / fpsCap;

  useFrame((state, delta) => {
    // Easing consistente do tint independente de FPS.
    const k = 3.2;
    const t = 1 - Math.exp(-k * delta);
    currentTintRef.current.lerp(targetTint, t);
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(currentTintRef.current);
    }
    if (lightRef.current) {
      lightRef.current.intensity += (intensity - lightRef.current.intensity) * t;
    }

    if (reduced) return;

    // FPS cap: só executa a animação de flutuação a cada minFrameTime.
    frameAccum.current += delta;
    if (frameAccum.current < minFrameTime) return;
    const step = frameAccum.current;
    frameAccum.current = 0;

    if (meshRef.current) {
      meshRef.current.rotation.y += step * (isMobile ? 0.1 : 0.15);
      meshRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.4) * (isMobile ? 0.08 : 0.12);
      meshRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.8) * (isMobile ? 0.1 : 0.15);
    }
    if (!isMobile && groupRef.current) {
      const { x, y } = state.pointer;
      groupRef.current.rotation.y += (x * 0.3 - groupRef.current.rotation.y) * 0.05;
      groupRef.current.rotation.x += (-y * 0.2 - groupRef.current.rotation.x) * 0.05;
    }
  });

  const size = isMobile ? 3.2 : 4.2;

  return (
    <>
      <ambientLight ref={lightRef} intensity={intensity} />
      <group ref={groupRef}>
        <mesh ref={meshRef}>
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial
            map={texture}
            transparent
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </>
  );
};

const FloatingBook3D = () => {
  const reduced = useReducedMotion();
  const { isMobile, lowEnd, saveData } = useDeviceProfile();
  const visible = usePageVisible();
  const lowBattery = useLowBattery();

  let theme: ThemeType = "safira";
  try {
    theme = useTheme().theme;
  } catch {
    theme = "safira";
  }
  const atmosphere = THEME_ATMOSPHERE[theme] ?? THEME_ATMOSPHERE.safira;

  // Perfil consolidado.
  const constrained = isMobile || lowEnd || saveData || lowBattery;

  // Asset: WebP mobile (28KB) para telas pequenas ou modo economia.
  const assetUrl = (constrained ? neonBookMobile.url : neonBookDesktop.url);

  // DPR mais baixo em dispositivos constrangidos.
  const dpr: [number, number] = constrained ? [1, 1.25] : [1, 1.75];

  // FPS cap: 20 se bateria fraca/save-data, 30 em mobile/low-end, 60 desktop.
  const fpsCap = lowBattery || saveData ? 20 : constrained ? 30 : 60;

  // Frameloop 'demand' quando aba oculta ou reduced-motion -> zera custo.
  const frameloop: "always" | "demand" =
    !visible || reduced ? "demand" : "always";

  const glowClass = constrained ? "blur-2xl opacity-30" : "blur-3xl opacity-40";
  const glowSize1 = isMobile ? "w-[260px] h-[260px]" : "w-[420px] h-[420px]";
  const glowSize2 = isMobile ? "w-[320px] h-[320px]" : "w-[520px] h-[520px]";

  const glowTransition = `background ${THEME_DURATION_MS}ms ${THEME_EASING}, opacity ${THEME_DURATION_MS}ms ${THEME_EASING}, filter ${THEME_DURATION_MS}ms ${THEME_EASING}`;

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-background"
      style={{ transition: `background-color ${THEME_DURATION_MS}ms ${THEME_EASING}` }}
    >
      <div
        className={`absolute top-[10%] left-[12%] rounded-full ${glowSize1} ${glowClass}`}
        style={{
          background: `radial-gradient(circle, ${atmosphere.glowA} 0%, transparent 70%)`,
          transition: glowTransition,
          willChange: "background, opacity",
        }}
      />
      <div
        className={`absolute bottom-[8%] right-[10%] rounded-full ${glowSize2} ${glowClass}`}
        style={{
          background: `radial-gradient(circle, ${atmosphere.glowB} 0%, transparent 70%)`,
          transition: glowTransition,
          willChange: "background, opacity",
        }}
      />

      <Canvas
        camera={{ position: [0, 0, 5], fov: isMobile ? 55 : 45 }}
        dpr={dpr}
        frameloop={frameloop}
        gl={{
          antialias: !constrained,
          alpha: true,
          powerPreference: constrained ? "low-power" : "high-performance",
        }}
      >
        <Suspense fallback={null}>
          <FloatingBookMesh
            reduced={reduced}
            isMobile={isMobile}
            tint={atmosphere.tint}
            intensity={atmosphere.intensity}
            fpsCap={fpsCap}
            assetUrl={assetUrl}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default FloatingBook3D;
