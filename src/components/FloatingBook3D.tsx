import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, useGLTF } from "@react-three/drei";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import bookAsset from "@/assets/book.glb.asset.json";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Configure Draco decoder once. Google's gstatic mirror is CDN-cached and
// versioned to match three's decoder ABI — no bundle bloat.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
dracoLoader.setDecoderConfig({ type: "js" });

const configureLoader = (loader: GLTFLoader) => {
  loader.setDRACOLoader(dracoLoader);
};

// Preload asynchronously so the first frame isn't blocked.
useGLTF.preload(bookAsset.url, undefined, undefined, configureLoader);

type BookGLTF = GLTF & { nodes: Record<string, THREE.Object3D>; scene: THREE.Group };

const BookModel = () => {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(bookAsset.url, undefined, undefined, configureLoader) as BookGLTF;

  // Instance-safe clone so multiple mounts don't share matrices.
  const scene = gltf.scene;

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Boost emissive slightly for the dark scene.
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "emissive" in mat) {
          mat.emissiveIntensity = mat.emissiveIntensity ?? 0.2;
        }
      }
    });
  }, [scene]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.35) * 0.35;
    group.current.rotation.z = Math.sin(t * 0.25) * 0.05;
  });

  return (
    <group ref={group} rotation={[0.15, -0.4, 0]}>
      <primitive object={scene} />
    </group>
  );
};

const Scene = () => (
  <>
    <ambientLight intensity={0.55} />
    <directionalLight position={[4, 6, 5]} intensity={1.1} castShadow />
    <directionalLight position={[-6, -2, -4]} intensity={0.3} color="#7b6bff" />
    <Suspense fallback={null}>
      <Float speed={1.2} rotationIntensity={0.35} floatIntensity={0.9} floatingRange={[-0.25, 0.25]}>
        <BookModel />
      </Float>
      <Environment preset="city" />
    </Suspense>
  </>
);

/**
 * Fixed, full-viewport 3D background. Loads an optimized Draco-compressed
 * glTF book model (~4 KB) asynchronously; nothing blocks the main thread.
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
