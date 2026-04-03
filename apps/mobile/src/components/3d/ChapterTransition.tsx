import React, { useRef, useMemo, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// ChapterTransition -- dramatic tunnel / warp effect for chapter boundaries
//
// 20 torus rings recede into the distance. The camera flies forward through
// them over 3 seconds, rings glow as they pass, then onComplete fires.
// ---------------------------------------------------------------------------

interface ChapterTransitionProps {
  fromChapter: number;
  toChapter: number;
  onComplete: () => void;
}

const RING_COUNT = 20;
const RING_SPACING = 1.5;
const TUNNEL_LENGTH = RING_COUNT * RING_SPACING;
const DURATION = 3; // seconds

// Colour ramp: dim at start, bright at mid-point, dim at exit
function chapterColor(fromChapter: number, toChapter: number): THREE.Color {
  // Each chapter gets a unique hue; blend from -> to
  const hueFrom = (fromChapter * 0.15) % 1;
  const hueTo = (toChapter * 0.15) % 1;
  const avg = (hueFrom + hueTo) / 2;
  return new THREE.Color().setHSL(avg, 0.9, 0.55);
}

// ---------------------------------------------------------------------------
// Inner scene components
// ---------------------------------------------------------------------------

function TunnelRings({
  baseColor,
  progress,
}: {
  baseColor: THREE.Color;
  progress: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Pre-build ring meshes with shared geometry
  const { geometry, rings } = useMemo(() => {
    const geo = new THREE.TorusGeometry(1.6, 0.03, 8, 48);
    const items: { z: number; material: THREE.MeshBasicMaterial }[] = [];

    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: baseColor.clone().multiplyScalar(0.15),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      items.push({ z: -(i * RING_SPACING), material: mat });
    }

    return { geometry: geo, rings: items };
  }, [baseColor]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = progress.current; // 0..1

    rings.forEach((ring, i) => {
      const mesh = groupRef.current!.children[i] as THREE.Mesh;
      if (!mesh) return;

      // How close is the camera to this ring? Camera z travels 0 -> -TUNNEL_LENGTH
      const cameraZ = -t * TUNNEL_LENGTH;
      const dist = Math.abs(ring.z - cameraZ);

      // Glow when nearby
      const glow = Math.max(0, 1 - dist / (RING_SPACING * 2.5));
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(baseColor).multiplyScalar(0.15 + glow * 0.85);
      mat.opacity = 0.3 + glow * 0.7;

      // Slight scale pulse near the camera
      const s = 1 + glow * 0.15;
      mesh.scale.set(s, s, s);
    });
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={ring.material}
          position={[0, 0, ring.z]}
          rotation={[0, 0, (i * Math.PI) / 10]}
        />
      ))}
    </group>
  );
}

function CameraDriver({
  progress,
}: {
  progress: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const elapsed = useRef(0);

  useFrame((_state, delta) => {
    elapsed.current = Math.min(elapsed.current + delta, DURATION);
    const t = elapsed.current / DURATION;
    // Ease-in-out (smoothstep)
    const smooth = t * t * (3 - 2 * t);
    progress.current = smooth;

    camera.position.z = -smooth * TUNNEL_LENGTH;
  });

  return null;
}

// ---------------------------------------------------------------------------
// Radial speed-line particles
// ---------------------------------------------------------------------------

function SpeedLines({ baseColor }: { baseColor: THREE.Color }) {
  const pointsRef = useRef<THREE.Points>(null);
  const LINE_COUNT = 80;

  const { positions, seeds } = useMemo(() => {
    const pos = new Float32Array(LINE_COUNT * 3);
    const sd = new Float32Array(LINE_COUNT); // angle around tunnel

    for (let i = 0; i < LINE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.0 + Math.random() * 0.8;
      sd[i] = angle;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * radius;
      pos[i * 3 + 2] = -Math.random() * TUNNEL_LENGTH;
    }

    return { positions: pos, seeds: sd };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      color: baseColor,
      size: 0.03,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      sizeAttenuation: true,
    });
  }, [baseColor]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Move lines toward the camera to create a speed effect
    for (let i = 0; i < LINE_COUNT; i++) {
      arr[i * 3 + 2] += delta * 6;
      if (arr[i * 3 + 2] > 2) {
        arr[i * 3 + 2] = -TUNNEL_LENGTH + Math.random() * 4;
      }
    }
    posAttr.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function ChapterTransition({
  fromChapter,
  toChapter,
  onComplete,
}: ChapterTransitionProps) {
  const progress = useRef(0);
  const [opacity, setOpacity] = useState(1);

  const baseColor = useMemo(
    () => chapterColor(fromChapter, toChapter),
    [fromChapter, toChapter]
  );

  // Fire onComplete after DURATION seconds, fade out over the last 0.5s
  useEffect(() => {
    const fadeStart = (DURATION - 0.5) * 1000;
    const fadeTimer = setTimeout(() => setOpacity(0), fadeStart);
    const completeTimer = setTimeout(onComplete, DURATION * 1000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <View style={[styles.overlay, { opacity }]}>
      <Canvas
        frameloop="always"
        camera={{ position: [0, 0, 0], fov: 75 }}
        gl={{ alpha: false, antialias: false, powerPreference: "low-power" }}
      >
        {/* Ambient light keeps rings subtly visible even when not glowing */}
        <ambientLight intensity={0.1} />

        <TunnelRings baseColor={baseColor} progress={progress} />
        <SpeedLines baseColor={baseColor} />
        <CameraDriver progress={progress} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: "#000",
  },
});
