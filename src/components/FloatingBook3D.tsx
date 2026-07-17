import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import neonBookAsset from "@/assets/neon-book-hero.png.asset.json";
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


/**
 * Plano de fundo 3D com a imagem neon do livro como textura.
 * - Respeita prefers-reduced-motion (com listener dinâmico).
 * - Ajusta DPR, tamanho do plano, parallax e blur em mobile / dispositivos fracos.
 */

type PerfProfile = {
  reduced: boolean;
  isMobile: boolean;
  lowEnd: boolean;
};

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

const useDeviceProfile = (): { isMobile: boolean; lowEnd: boolean } => {
  const [profile, setProfile] = useState({ isMobile: false, lowEnd: false });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const cores = navigator.hardwareConcurrency ?? 8;
      // @ts-expect-error deviceMemory não é padrão em todos os TS libs
      const mem: number | undefined = navigator.deviceMemory;
      const lowEnd = cores <= 4 || (typeof mem === "number" && mem <= 4);
      setProfile({ isMobile, lowEnd });
    };
    compute();
    const mq = window.matchMedia("(max-width: 768px)");
    mq.addEventListener?.("change", compute);
    return () => mq.removeEventListener?.("change", compute);
  }, []);
  return profile;
};

const FloatingBookMesh = ({
  reduced,
  isMobile,
  tint,
  intensity,
}: {
  reduced: boolean;
  isMobile: boolean;
  tint: [number, number, number];
  intensity: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.AmbientLight>(null);
  const texture = useLoader(THREE.TextureLoader, neonBookAsset.url);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = isMobile ? 2 : 4;
  }, [texture, isMobile]);

  // Alvo de tint atualizado a cada mudança de tema; interpolação acontece no frame loop.
  const targetTint = useMemo(
    () => new THREE.Color(tint[0], tint[1], tint[2]),
    [tint[0], tint[1], tint[2]]
  );
  const currentTintRef = useRef(new THREE.Color(tint[0], tint[1], tint[2]));

  useFrame((state, delta) => {
    // Easing consistente do tint e da intensidade de luz mesmo com prefers-reduced-motion.
    // Fator ~1 - exp(-k*dt) => easing exponencial estável independente de FPS.
    const k = 3.2; // ~ease-out ~600ms
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
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (isMobile ? 0.1 : 0.15);
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


// Curva de easing consistente para transições CSS de glow entre temas.
const THEME_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"; // ease-out-quint
const THEME_DURATION_MS = 900;

const FloatingBook3D = () => {
  const reduced = useReducedMotion();
  const { isMobile, lowEnd } = useDeviceProfile();

  // Tema atual (sincronizado com o leitor). Se o Provider não estiver disponível, usa safira.
  let theme: ThemeType = "safira";
  try {
    theme = useTheme().theme;
  } catch {
    theme = "safira";
  }
  const atmosphere = THEME_ATMOSPHERE[theme] ?? THEME_ATMOSPHERE.safira;

  const dpr: [number, number] = isMobile || lowEnd ? [1, 1.25] : [1, 1.75];
  // Em reduced-motion mantemos 'always' por um breve período para animar o tint.
  // Como o lerp converge rápido, deixamos 'always' — custo baixo, transição suave.
  const frameloop: "always" | "demand" = "always";

  const glowClass = isMobile || lowEnd ? "blur-2xl opacity-30" : "blur-3xl opacity-40";
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
          antialias: !isMobile,
          alpha: true,
          powerPreference: lowEnd ? "low-power" : "high-performance",
        }}
      >
        <Suspense fallback={null}>
          <FloatingBookMesh
            reduced={reduced}
            isMobile={isMobile}
            tint={atmosphere.tint}
            intensity={atmosphere.intensity}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};



export default FloatingBook3D;
