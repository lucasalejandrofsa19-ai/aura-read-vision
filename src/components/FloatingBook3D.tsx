import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Procedural floating book mesh — no external GLTF needed.
 * Cover + spine + pages built from BoxGeometry with subtle
 * PBR materials tuned for the app's primary/accent palette.
 */
const Book = () => {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    // gentle yaw + slight roll on top of Float's translation
    group.current.rotation.y = Math.sin(t * 0.35) * 0.35;
    group.current.rotation.z = Math.sin(t * 0.25) * 0.05;
  });

  const coverMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#2b1e5c"),
        roughness: 0.45,
        metalness: 0.35,
        emissive: new THREE.Color("#5b4bd6"),
        emissiveIntensity: 0.12,
      }),
    []
  );
  const pagesMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f4efe6"),
        roughness: 0.9,
        metalness: 0,
      }),
    []
  );
  const spineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#c9a24b"),
        roughness: 0.35,
        metalness: 0.8,
        emissive: new THREE.Color("#d4a94a"),
        emissiveIntensity: 0.15,
      }),
    []
  );

  return (
    <group ref={group} rotation={[0.15, -0.4, 0]}>
      {/* Cover (top + bottom sandwich the pages) */}
      <mesh castShadow receiveShadow position={[0, 0.28, 0]} material={coverMat}>
        <boxGeometry args={[2.2, 0.08, 3]} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.28, 0]} material={coverMat}>
        <boxGeometry args={[2.2, 0.08, 3]} />
      </mesh>
      {/* Pages block */}
      <mesh position={[0.03, 0, 0]} material={pagesMat}>
        <boxGeometry args={[2.1, 0.48, 2.92]} />
      </mesh>
      {/* Spine */}
      <mesh position={[-1.05, 0, 0]} material={spineMat}>
        <boxGeometry args={[0.12, 0.6, 3]} />
      </mesh>
      {/* Decorative gold band on cover */}
      <mesh position={[0.4, 0.33, 0]} material={spineMat}>
        <boxGeometry args={[0.6, 0.01, 2.4]} />
      </mesh>
    </group>
  );
};

const Scene = () => {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} castShadow />
      <directionalLight position={[-6, -2, -4]} intensity={0.3} color="#7b6bff" />
      <Suspense fallback={null}>
        <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.9} floatingRange={[-0.25, 0.25]}>
          <Book />
        </Float>
        <Environment preset="city" />
      </Suspense>
    </>
  );
};

/**
 * Fixed, full-viewport 3D background. Sits behind all content (z-index: -1),
 * ignores pointer events, and yields to prefers-reduced-motion.
 */
export const FloatingBook3D = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  if (prefersReducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 hidden md:block"
      style={{ contain: "strict" }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.6, 6.5], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        frameloop="always"
      >
        <Scene />
      </Canvas>
    </div>
  );
};

export default FloatingBook3D;
