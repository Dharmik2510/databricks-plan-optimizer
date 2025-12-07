import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';

// Component to represent a floating "Dataframe" Grid
const DataframeGrid = ({ position, rotation, scale, color }: { position: [number, number, number], rotation: [number, number, number], scale: number, color: string }) => {
    return (
        <Float floatIntensity={2} rotationIntensity={1} speed={1.5}>
            <group position={position} rotation={rotation} scale={scale}>
                {/* Main Grid Plane */}
                <gridHelper args={[10, 10, color, color]} rotation={[Math.PI / 2, 0, 0]} />

                {/* Semi-transparent background for the grid to look like a glass panel */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[10, 10]} />
                    <meshStandardMaterial
                        color={color}
                        transparent
                        opacity={0.1}
                        side={THREE.DoubleSide}
                        metalness={0.8}
                        roughness={0.2}
                    />
                </mesh>

                {/* fake "data" blocks on the grid */}
                {[...Array(5)].map((_, i) => (
                    <mesh
                        key={i}
                        position={[
                            (Math.random() - 0.5) * 8,
                            (Math.random() - 0.5) * 8,
                            0.2 // slightly above the plane
                        ]}
                        rotation={[Math.PI / 2, 0, 0]}
                    >
                        <boxGeometry args={[1.5, 0.2, 0.4]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
                    </mesh>
                ))}
            </group>
        </Float>
    );
};

// Component for floating particles around the scene
const Particles = ({ count = 100 }) => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Generate random positions
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const t = Math.random() * 100;
            const factor = 20 + Math.random() * 100;
            const speed = 0.01 + Math.random() / 200;
            const xFactor = -50 + Math.random() * 100;
            const yFactor = -50 + Math.random() * 100;
            const zFactor = -50 + Math.random() * 100;
            temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
        }
        return temp;
    }, [count]);

    useFrame(() => {
        if (!mesh.current) return;

        particles.forEach((particle, i) => {
            let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
            t = particle.t += speed / 2;
            const a = Math.cos(t) + Math.sin(t * 1) / 10;
            const b = Math.sin(t) + Math.cos(t * 2) / 10;
            const s = Math.cos(t);

            dummy.position.set(
                (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
                (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
                (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
            );
            dummy.scale.set(s, s, s);
            dummy.rotation.set(s * 5, s * 5, s * 5);
            dummy.updateMatrix();

            mesh.current!.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.5} />
        </instancedMesh>
    );
};

export const ThreeBackground = ({ showGrids = true }: { showGrids?: boolean }) => {
    return (
        <div className="fixed inset-0 -z-10 bg-slate-900 pointer-events-none">
            <Canvas dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={50} />

                {/* Lighting */}
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#f97316" />
                <pointLight position={[-10, -10, -10]} intensity={1} color="#3b82f6" />

                {/* Background Environment */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* Floating "Dataframes" - Optional */}
                {showGrids && (
                    <>
                        <DataframeGrid
                            position={[-6, 2, -5]}
                            rotation={[0.5, 0.5, 0]}
                            scale={0.8}
                            color="#f97316" // Orange
                        />
                        <DataframeGrid
                            position={[6, -2, -8]}
                            rotation={[-0.5, -0.5, 0]}
                            scale={1}
                            color="#3b82f6" // Blue
                        />
                        <DataframeGrid
                            position={[0, 5, -15]}
                            rotation={[1, 0, 0.2]}
                            scale={1.5}
                            color="#10b981" // Green (Optimization)
                        />
                    </>
                )}

                {/* Connecting/Floating Particles */}
                <Particles count={150} />

            </Canvas>
        </div>
    );
};

export default ThreeBackground;
