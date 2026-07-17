import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import neonBookAsset from "@/assets/neon-book-hero.png.asset.json";

/**
 * Plano de fundo 3D com a imagem neon do livro como textura sobre um plano,
 * animado com rotação sutil, flutuação e parallax por mouse.
 * Respeita prefers-reduced-motion e usa DPR limitado para performance.
 */
const FloatingBookMesh = ({ reduced }: { reduced: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, neonBookAsset.url);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  useFrame((state, delta) => {
    if (reduced) return;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.12;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
    }
    if (groupRef.current) {
      // parallax sutil com o mouse
      const { x, y } = state.pointer;
      groupRef.current.rotation.y += (x * 0.3 - groupRef.current.rotation.y) * 0.05;
      groupRef.current.rotation.x += (-y * 0.2 - groupRef.current.rotation.x) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <planeGeometry args={[4.2, 4.2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const FloatingBook3D = () => {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-background"
    >
      {/* glows extras para reforçar o clima neon */}
      <div
        className="absolute top-[10%] left-[12%] w-[420px] h-[420px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #00e5ff 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[8%] right-[10%] w-[520px] h-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #b100ff 0%, transparent 70%)" }}
      />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.8} />
        <Suspense fallback={null}>
          <FloatingBookMesh reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default FloatingBook3D;
