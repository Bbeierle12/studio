
'use client';

import React, { useMemo, useRef, useEffect, Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text as DreiText, Line as DreiLine } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';

// Interfaces
interface Node {
  id: string;
  type?: string;
  url?: string;
  data?: any;
  title?: string;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Utility: Fibonacci sphere distribution for node placement
function generateSpherePoints(count: number, radius: number): Point3D[] {
  const points: Point3D[] = [];
  if (count === 0) return points;
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle in radians
  for (let i = 0; i < count; i++) {
    // y goes from 1 to -1, ensure (count - 1) is not 0 for single node
    const y = count === 1 ? 0 : 1 - (i / (Math.max(1, count - 1))) * 2;
    const r_sphere = Math.sqrt(1 - y * y);
    const theta_sphere = phi * i;
    const x = Math.cos(theta_sphere) * r_sphere;
    const z = Math.sin(theta_sphere) * r_sphere;
    points.push({ x: x * radius, y: y * radius, z: z * radius });
  }
  return points;
}

// Helper component to load texture for image nodes
function TextureLoaderHelper({ url }: { url: string }) {
  const texture = useMemo(() => new THREE.TextureLoader().load(url), [url]);
  return <primitive object={texture} attach="map" />;
}

// Pivot effect component (Temporarily removed for diagnostics)
/*
type PivotProps = {
  selectedNode: number | null;
  points: Point3D[];
  radius: number;
  controlsRef: React.RefObject<OrbitControlsImpl | undefined>;
};
function PivotEffect({ selectedNode, points, radius, controlsRef }: PivotProps) {
  const { camera } = useThree(); // This line requires useThree
  useEffect(() => {
    const controls = controlsRef.current;
    if (selectedNode !== null && controls && points[selectedNode]) {
      const targetPoint3D = points[selectedNode];
      const targetPoint = new THREE.Vector3(targetPoint3D.x, targetPoint3D.y, targetPoint3D.z);
      const distance = radius * 2.5; // Increased distance

      const newCameraPosition = new THREE.Vector3();
      // Handle case where targetPoint is at origin to avoid normalizing a zero vector
      if (targetPoint.lengthSq() === 0) {
        newCameraPosition.set(0, 0, distance); // Default position if target is origin
      } else {
        newCameraPosition.copy(targetPoint).normalize().multiplyScalar(distance);
      }

      // Smoothly interpolate camera position and target
      // Ensure camera and controls are defined before lerping
      if (camera && controls.target) {
        camera.position.lerp(newCameraPosition, 0.1);
        controls.target.lerp(targetPoint, 0.1);
        controls.update(); // Required after manually changing controls.target
      }
    }
  }, [selectedNode, points, radius, camera, controlsRef]); // Added camera and controlsRef to dependencies
  return null;
}
*/


interface DynamicMapRendererProps {
  nodes?: Node[];
  links?: [number, number][];
  search?: string;
  selectedNode?: number | null;
  startNode?: number | null;
  endNode?: number | null;
  radius?: number;
  onNodeClick?: (index: number) => void;
}

const DynamicMapRenderer: React.FC<DynamicMapRendererProps> = ({
  nodes = [],
  links = [],
  search = '',
  selectedNode = null,
  startNode = null,
  endNode = null,
  radius = 10,
  onNodeClick = () => {},
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl>();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const points = useMemo(() => generateSpherePoints(nodes.length, radius), [nodes, radius]);

  const matches = useMemo(() => {
    if (!search) return new Set<number>();
    const lowerSearch = search.toLowerCase();
    return new Set(
      nodes.reduce<number[]>((acc, n, idx) => {
        const titleMatch = n.title && n.title.toLowerCase().includes(lowerSearch);
        const idMatch = n.id.toLowerCase().includes(lowerSearch);
        if (titleMatch || idMatch) acc.push(idx);
        return acc;
      }, [])
    );
  }, [search, nodes]);

  const displayedLinks = useMemo(() => {
    if (nodes.length === 0) return [];
    const validLinks = links.filter(([a,b]) => a >= 0 && a < nodes.length && b >= 0 && b < nodes.length && a !== b );
    if (!search) return validLinks;
    return validLinks.filter(([a, b]) => matches.has(a) || matches.has(b));
  }, [search, matches, links, nodes.length]);

  const [pathPoints, setPathPoints] = React.useState<Point3D[]>([]);

  useEffect(() => {
    if (startNode !== null && endNode !== null && points[startNode] && points[endNode]) {
      const p1 = points[startNode]; // Point3D
      const p2 = points[endNode]; // Point3D

      // Convert Point3D to local THREE.Vector3 instances for calculation
      const p1Vec = new THREE.Vector3(p1.x, p1.y, p1.z).normalize();
      const p2Vec = new THREE.Vector3(p2.x, p2.y, p2.z).normalize();
      
      const arcForThree: Point3D[] = [];
      const dotProduct = p1Vec.dot(p2Vec);
      const theta = Math.acos(THREE.MathUtils.clamp(dotProduct, -1, 1)); // Angle between vectors
      const steps = Math.max(2, Math.floor(theta * radius / 0.5) || 32); // Number of segments in the arc

      if (Math.abs(theta) < 0.0001 || Math.abs(Math.sin(theta)) < 0.0001) { // If vectors are collinear or nearly collinear, use LERP
        for (let t = 0; t <= steps; t++) {
          const f = t / steps;
          const lerpVec = new THREE.Vector3().lerpVectors(p1Vec, p2Vec, f);
          lerpVec.normalize().multiplyScalar(radius); // Ensure it's on the sphere of desired radius
          arcForThree.push({ x: lerpVec.x, y: lerpVec.y, z: lerpVec.z });
        }
      } else {
        const sinTheta = Math.sin(theta);
        for (let t = 0; t <= steps; t++) {
          const f = t / steps;
          const c1 = Math.sin((1 - f) * theta) / sinTheta;
          const c2 = Math.sin(f * theta) / sinTheta;

          const arcVec = new THREE.Vector3(
            c1 * p1Vec.x + c2 * p2Vec.x,
            c1 * p1Vec.y + c2 * p2Vec.y,
            c1 * p1Vec.z + c2 * p2Vec.z
          );
          // The slerp formula with these coefficients should result in a vector on the unit sphere
          // if p1Vec and p2Vec were normalized. Then we scale by the desired radius.
          // For safety, explicitly normalize before scaling if precision issues are a concern.
          arcVec.normalize().multiplyScalar(radius); 
          arcForThree.push({ x: arcVec.x, y: arcVec.y, z: arcVec.z });
        }
      }
      setPathPoints(arcForThree);
    } else {
      setPathPoints([]);
    }
  }, [startNode, endNode, points, radius]);


  interface NodeMeshProps {
    position: Point3D;
    data: Node;
    highlight: boolean;
    index: number;
    isStart?: boolean;
    isEnd?: boolean;
    onClick: (index: number) => void;
  }

  const NodeMeshComponent = ({ position, data, highlight, index, isStart, isEnd, onClick: handleNodeClickProp }: NodeMeshProps) => {
    let color = 'hsl(var(--primary))';
    if (isStart) color = 'lime';
    else if (isEnd) color = 'orange';
    else if (highlight) color = 'hsl(var(--accent))';

    return (
      <group position={[position.x, position.y, position.z]} onClick={(e) => { e.stopPropagation(); handleNodeClickProp(index);}}>
        <mesh>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.1}/>
        </mesh>
        <DreiText
            position={[0, 0.5, 0]} // Position text above the sphere
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01} // Optional: adds a thin outline for better readability
            outlineColor="#333333"
          >
          {data.title || data.id}
        </DreiText>
        {data.url && data.type === 'image' && (
           <mesh position={[0, 0, 0.4]} rotation={[0, Math.PI, 0]}> {/* Position image slightly in front, rotate to face camera */}
            <planeGeometry args={[0.5, 0.5]} /> {/* Adjust size as needed */}
            <meshBasicMaterial transparent side={THREE.DoubleSide}> {/* Ensure transparency and double-sided rendering */}
                <Suspense fallback={null}> {/* Suspense for async texture loading */}
                    <TextureLoaderHelper url={data.url} />
                </Suspense>
            </meshBasicMaterial>
          </mesh>
        )}
      </group>
    );
  };

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg shadow-inner">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Initializing Renderer...</p>
      </div>
    );
  }

  return (
    <Canvas
      shadows
      camera={{ position: [0, 0, radius * 2.5], fov: 50 }}
      style={{ background: 'hsl(var(--background))', touchAction: 'none' }} // Added touchAction none for orbit controls
      onPointerMissed={(event) => {
        // Check if the click was not on a child of the canvas (e.g. UI overlay)
        if (event.target === event.currentTarget) {
           onNodeClick(-1); // Convention for deselecting
        }
      }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight
          position={[5, 10, 7.5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
      />
      <pointLight position={[-5, -5, -10]} intensity={0.5} color="hsl(var(--accent))" />

      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />

      {/* <PivotEffect selectedNode={selectedNode} points={points} radius={radius} controlsRef={controlsRef} /> */}

      <Suspense fallback={null}> {/* General suspense for all nodes if needed, or can be per-node */}
        {nodes.map((node, i) => points[i] && (
          <NodeMeshComponent
            key={`${node.id}-${i}-${node.title || i}`} // More robust key
            index={i}
            position={points[i]}
            data={node}
            highlight={matches.has(i)}
            isStart={i === startNode}
            isEnd={i === endNode}
            onClick={onNodeClick}
          />
        ))}
      </Suspense>

      {displayedLinks.map(([a, b], idx) => {
        if (!points[a] || !points[b]) return null; // Ensure points exist
        // Convert Point3D to [number, number, number][] for DreiLine
        const linePoints: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [
            [points[a].x, points[a].y, points[a].z],
            [points[b].x, points[b].y, points[b].z]
        ];
        return (
          <DreiLine
            key={`link-${idx}-${a}-${b}`}
            points={linePoints}
            lineWidth={1}
            color={
              matches.has(a) || matches.has(b)
                ? 'hsl(var(--accent))'
                : 'hsl(var(--primary))'
            }
            dashed={false} // Links are not dashed by default
          />
        );
      })}

      {pathPoints.length > 1 && (
        <DreiLine
            points={pathPoints.map(p => [p.x, p.y, p.z] as THREE.Vector3Tuple)} // Convert Point3D[] to Vector3Tuple[]
            lineWidth={2.5} color="yellow" dashed={true} dashSize={0.2} gapSize={0.1} />
      )}
    </Canvas>
  );
};

export default DynamicMapRenderer;

