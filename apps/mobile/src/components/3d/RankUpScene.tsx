import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RankUpSceneProps {
  rankColor: string;
  rankName: string;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Badge -- rotating octagonal emblem at the centre of the scene
// ---------------------------------------------------------------------------

function Badge({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scaleProgress = useRef(0);

  // Memoize colors so we don't re-create every frame
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Continuous Y rotation
    mesh.rotation.y += delta * 1.2;

    // Spring-style scale-up: ease toward 1 from 0
    if (scaleProgress.current < 1) {
      // Simple critically-damped spring approximation
      scaleProgress.current = Math.min(
        1,
        scaleProgress.current + delta * (1 - scaleProgress.current) * 4 + delta * 0.4,
      );
      const s = scaleProgress.current;
      mesh.scale.set(s, s, s);
    }
  });

  return (
    <mesh ref={meshRef} scale={[0, 0, 0]}>
      {/*
        CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
        8 radial segments gives an octagonal cross-section.
      */}
      <cylinderGeometry args={[1.1, 1.1, 0.25, 8]} />
      <meshStandardMaterial
        color={threeColor}
        emissive={threeColor}
        emissiveIntensity={0.7}
        metalness={0.6}
        roughness={0.25}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Particles -- burst of small spheres radiating from the centre
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 64;

interface ParticleData {
  direction: THREE.Vector3;
  speed: number;
  isWhite: boolean;
}

function Particles({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const elapsed = useRef(0);

  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);

  // Pre-compute random directions and speeds once
  const particleData = useMemo<ParticleData[]>(() => {
    const data: ParticleData[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random point on a sphere (uniform distribution)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      );
      data.push({
        direction: dir,
        speed: 1.8 + Math.random() * 2.5, // varying burst speeds
        isWhite: Math.random() < 0.25, // ~25 % white particles
      });
    }
    return data;
  }, []);

  // Shared geometry & materials (instanced for performance)
  const geometry = useMemo(() => new THREE.SphereGeometry(0.06, 6, 6), []);
  const colorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: threeColor,
        emissive: threeColor,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 1,
      }),
    [threeColor],
  );
  const whiteMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: white,
        emissive: white,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 1,
      }),
    [white],
  );

  useFrame((_state, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;

    // Delay burst slightly so the badge scale-up is visible first
    const burstStart = 0.3;
    if (t < burstStart) return;

    const burstT = t - burstStart;
    const fadeDuration = 3.0; // seconds over which particles fully fade

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const { direction, speed } = particleData[i];

      // Position: simple outward motion with slight deceleration
      const decel = 1 / (1 + burstT * 0.6);
      const dist = speed * burstT * decel;
      mesh.position.set(
        direction.x * dist,
        direction.y * dist,
        direction.z * dist,
      );

      // Fade opacity
      const opacity = Math.max(0, 1 - burstT / fadeDuration);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = opacity;

      // Shrink slightly as they fade
      const s = 0.6 + 0.4 * opacity;
      mesh.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef}>
      {particleData.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          geometry={geometry}
          material={p.isWhite ? whiteMaterial : colorMaterial}
          position={[0, 0, 0]}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Error boundary -- if Canvas fails we render nothing (graceful fallback)
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
}

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// RankUpScene -- public component
// ---------------------------------------------------------------------------

export function RankUpScene({
  rankColor,
  rankName,
  onComplete,
}: RankUpSceneProps) {
  const [active, setActive] = useState(true);

  // Auto-dismiss after 3.5 s
  useEffect(() => {
    const timer = setTimeout(() => {
      setActive(false);
      onComplete();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!active) return null;

  return (
    <SceneErrorBoundary>
      <View style={styles.container} pointerEvents="none">
        <Canvas
          frameloop="always"
          gl={{ alpha: true }}
          style={styles.canvas}
          camera={{ position: [0, 0, 5], fov: 50 }}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[0, 0, 5]} intensity={1} />
          <Badge color={rankColor} />
          <Particles color={rankColor} />
        </Canvas>
      </View>
    </SceneErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  canvas: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
