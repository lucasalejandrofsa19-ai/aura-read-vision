import {
  Suspense,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Public imperative API. */
export type FloatingBookHandle = {
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (index: number) => void;
  getPage: () => number;
  getPageCount: () => number;
};

// ---------------------------------------------------------------------------
// Materials — shared across every page/cover so the GPU keeps one pipeline.
// ---------------------------------------------------------------------------
const useBookMaterials = () =>
  useMemo(() => {
    const cover = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2b1e5c"),
      roughness: 0.45,
      metalness: 0.35,
      emissive: new THREE.Color("#5b4bd6"),
      emissiveIntensity: 0.12,
    });
    const spine = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c9a24b"),
      roughness: 0.35,
      metalness: 0.8,
      emissive: new THREE.Color("#d4a94a"),
      emissiveIntensity: 0.18,
    });
    // Front and back page faces get slightly different tints so the flip reads.
    const pageFront = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f6f0e2"),
      roughness: 0.92,
      metalness: 0,
      side: THREE.FrontSide,
    });
    const pageBack = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ece2ca"),
      roughness: 0.95,
      metalness: 0,
      side: THREE.FrontSide,
    });
    return { cover, spine, pageFront, pageBack };
  }, []);

// ---------------------------------------------------------------------------
// A single page: hinged at the spine (x = 0), extending in +X when closed.
// We use two thin planes back-to-back so the front/back tints differ.
// ---------------------------------------------------------------------------
type PageProps = {
  width: number;
  height: number;
  turn: number; // 0 = right side (unturned), 1 = left side (fully turned)
  front: THREE.Material;
  back: THREE.Material;
  y: number;
};

const Page = ({ width, height, turn, front, back, y }: PageProps) => {
  const hinge = useRef<THREE.Group>(null);
  // Ease-in-out for organic page motion.
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(turn, 0, 1));
  const angle = eased * Math.PI; // 0 → PI (flips to the left)

  useFrame(() => {
    if (hinge.current) hinge.current.rotation.y = -angle;
  });

  return (
    <group ref={hinge} position={[0, y, 0]}>
      {/* Front face */}
      <mesh position={[width / 2, 0, 0.001]} material={front}>
        <planeGeometry args={[width, height]} />
      </mesh>
      {/* Back face (rotated to face the other way) */}
      <mesh position={[width / 2, 0, -0.001]} rotation={[0, Math.PI, 0]} material={back}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// The book itself — covers + spine + a stack of animated pages.
// ---------------------------------------------------------------------------
type BookProps = {
  turnProgress: number; // continuous progress across all pages (0..pageCount)
  pageCount: number;
};

const Book = ({ turnProgress, pageCount }: BookProps) => {
  const group = useRef<THREE.Group>(null);
  const materials = useBookMaterials();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = -0.4 + Math.sin(t * 0.35) * 0.25;
    group.current.rotation.z = Math.sin(t * 0.25) * 0.04;
  });

  const pageWidth = 2.1;
  const pageHeight = 2.92;
  const pageStackHalf = 0.24; // half-thickness of the stack

  return (
    <group ref={group} rotation={[0.18, -0.4, 0]}>
      {/* Bottom cover */}
      <mesh position={[0, -0.32, 0]} material={materials.cover}>
        <boxGeometry args={[2.2, 0.08, 3]} />
      </mesh>
      {/* Top cover — placed slightly open so the pages read as a spread */}
      <mesh position={[0, 0.32, 0]} material={materials.cover}>
        <boxGeometry args={[2.2, 0.08, 3]} />
      </mesh>
      {/* Spine */}
      <mesh position={[-0.05, 0, 0]} material={materials.spine}>
        <boxGeometry args={[0.12, 0.66, 3]} />
      </mesh>
      {/* Decorative band */}
      <mesh position={[0.4, 0.365, 0]} material={materials.spine}>
        <boxGeometry args={[0.6, 0.012, 2.4]} />
      </mesh>

      {/* Page stack — hinged at spine (x = 0), extending to +X */}
      <group position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {Array.from({ length: pageCount }).map((_, i) => {
          // Per-page progress: page i turns as global progress crosses i..i+1.
          const local = THREE.MathUtils.clamp(turnProgress - i, 0, 1);
          // Layered offset so pages don't z-fight; turned pages drift left.
          const restY = -pageStackHalf + (i / (pageCount - 1)) * (pageStackHalf * 2);
          return (
            <Page
              key={i}
              width={pageWidth}
              height={pageHeight}
              turn={local}
              front={materials.pageFront}
              back={materials.pageBack}
              y={restY}
            />
          );
        })}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Scene wrapper with auto-flip driver + imperative handle.
// ---------------------------------------------------------------------------
type SceneProps = {
  targetPage: number;
  pageCount: number;
};

const Scene = ({ targetPage, pageCount }: SceneProps) => {
  const progress = useRef(0);
  const [_, force] = useState(0);

  useFrame((_state, dt) => {
    // Smoothly ease progress towards targetPage.
    const target = targetPage;
    const current = progress.current;
    const delta = target - current;
    if (Math.abs(delta) < 0.0005) {
      if (current !== target) {
        progress.current = target;
        force((n) => n + 1);
      }
      return;
    }
    // Critically-damped-ish easing — ~0.9s to close a full flip.
    const speed = Math.min(1, dt * 3.2);
    progress.current = current + delta * speed;
    force((n) => (n + 1) % 1024);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} />
      <directionalLight position={[-6, -2, -4]} intensity={0.35} color="#7b6bff" />
      <Suspense fallback={null}>
        <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7} floatingRange={[-0.2, 0.2]}>
          <Book turnProgress={progress.current} pageCount={pageCount} />
        </Float>
        <Environment preset="city" />
      </Suspense>
    </>
  );
};

// ---------------------------------------------------------------------------
// Public component — replaces the previous static book.
// ---------------------------------------------------------------------------
type FloatingBookProps = {
  /** Total pages in the deck. Defaults to 8. */
  pageCount?: number;
  /** Auto-advance interval (ms). Set 0 to disable. Defaults to 2600. */
  autoAdvanceMs?: number;
};

export const FloatingBook3D = forwardRef<FloatingBookHandle, FloatingBookProps>(
  ({ pageCount = 8, autoAdvanceMs = 2600 }, ref) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [targetPage, setTargetPage] = useState(0);

    const setPage = (n: number) => {
      // Clamp to [0, pageCount]; last "page" == fully turned deck.
      const clamped = Math.max(0, Math.min(pageCount, Math.floor(n)));
      setTargetPage(clamped);
    };

    useImperativeHandle(
      ref,
      () => ({
        nextPage: () => setTargetPage((p) => (p >= pageCount ? 0 : p + 1)),
        previousPage: () => setTargetPage((p) => (p <= 0 ? pageCount : p - 1)),
        goToPage: (i: number) => setPage(i),
        getPage: () => targetPage,
        getPageCount: () => pageCount,
      }),
      [pageCount, targetPage]
    );

    // Auto-advance with silent loop.
    useEffect(() => {
      if (prefersReducedMotion || !autoAdvanceMs) return;
      const id = window.setInterval(() => {
        setTargetPage((p) => (p >= pageCount ? 0 : p + 1));
      }, autoAdvanceMs);
      return () => window.clearInterval(id);
    }, [autoAdvanceMs, pageCount, prefersReducedMotion]);

    // Keyboard nav — global left/right cycles the deck (background flair only).
    useEffect(() => {
      if (prefersReducedMotion) return;
      const onKey = (e: KeyboardEvent) => {
        // Ignore when user is typing.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        if (e.key === "ArrowRight")
          setTargetPage((p) => (p >= pageCount ? 0 : p + 1));
        else if (e.key === "ArrowLeft")
          setTargetPage((p) => (p <= 0 ? pageCount : p - 1));
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [pageCount, prefersReducedMotion]);

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
        >
          <Scene targetPage={targetPage} pageCount={pageCount} />
        </Canvas>
      </div>
    );
  }
);

FloatingBook3D.displayName = "FloatingBook3D";

export { FloatingBook3D };

// Default export wrapped as a plain function component so React.lazy() can
// consume it reliably (lazy() with a forwardRef default caused
// "Component is not a function" in some HMR/bundle scenarios).
const FloatingBook3DDefault = (props: FloatingBookProps) => (
  <FloatingBook3D {...props} />
);
FloatingBook3DDefault.displayName = "FloatingBook3DDefault";

export default FloatingBook3DDefault;
