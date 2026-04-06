import React, { useRef, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// ParticleField -- ambient floating particle background
// Uses THREE.Points (single draw call) for maximum efficiency.
// ---------------------------------------------------------------------------

interface ParticleFieldProps {
  color?: string;
  count?: number;
}

// Vertical bounds for the particle volume
const Y_MIN = -3;
const Y_MAX = 3;
const SPREAD_X = 4;
const SPREAD_Z = 4;

function Particles({ color, count }: { color: string; count: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  // Initialise positions and per-particle random seeds once.
  const { positions, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sd = new Float32Array(count * 2); // [speed, phaseOffset] per particle

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * SPREAD_X * 2; // x
      pos[i3 + 1] = Y_MIN + Math.random() * (Y_MAX - Y_MIN); // y
      pos[i3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2; // z

      sd[i * 2] = 0.1 + Math.random() * 0.15; // upward speed
      sd[i * 2 + 1] = Math.random() * Math.PI * 2; // sine phase offset
    }

    return { positions: pos, seeds: sd };
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 0.04, // small particles
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    });
  }, [color]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const time = _state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const speed = seeds[i * 2];
      const phase = seeds[i * 2 + 1];

      // Drift upward
      arr[i3 + 1] += speed * delta;

      // Gentle horizontal sine wave
      arr[i3] += Math.sin(time * 0.4 + phase) * 0.002;

      // Respawn at bottom when particle exits top
      if (arr[i3 + 1] > Y_MAX) {
        arr[i3 + 1] = Y_MIN;
        arr[i3] = (Math.random() - 0.5) * SPREAD_X * 2;
        arr[i3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2;
      }
    }

    posAttr.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export function ParticleField({
  color = "#00FF88",
  count = 60,
}: ParticleFieldProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <Canvas
        frameloop="always"
        style={{ backgroundColor: "transparent" }}
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
      >
        <Particles color={color} count={count} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});
