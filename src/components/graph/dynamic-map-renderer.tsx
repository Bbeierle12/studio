
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
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
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
    if (startNode !== null && endNode !== null && points[startNode] && points[endNode] && nodes[startNode] && nodes[endNode]) {
      const p1 = points[startNode]; // Point3D
      const p2 = points[endNode]; // Point3D

      // Convert Point3D to THREE.Vector3 for slerp
      const p1Vec = new THREE.Vector3(p1.x, p1.y, p1.z);
      const p2Vec = new THREE.Vector3(p2.x, p2.y, p2.z);

      const arcForThree: Point3D[] = [];
      // Ensure angle is not NaN if p1 or p2 are zero vectors, or identical
      const angle = (p1Vec.lengthSq() > 0 && p2Vec.lengthSq() > 0) ? p1Vec.angleTo(p2Vec) : 0;
      const steps = Math.max(2, Math.floor(angle * radius / 0.5)); // Calculate steps based on angle and radius

      for (let t = 0; t <= steps; t++) {
        const f = t / steps;

        const currentArcVec = new THREE.Vector3();
        currentArcVec.copy(p1Vec);
        // Explicitly call slerp via prototype
        if (typeof THREE.Vector3.prototype.slerp === 'function') {
          THREE.Vector3.prototype.slerp.call(currentArcVec, p2Vec, f);
        } else {
          console.error("THREE.Vector3.prototype.slerp is not a function!");
           // Fallback to lerp if slerp is missing
          if (typeof THREE.Vector3.prototype.lerp === 'function') {
            THREE.Vector3.prototype.lerp.call(currentArcVec, p2Vec, f);
          } else {
            console.error("THREE.Vector3.prototype.lerp is also not a function!");
            // As a last resort, manual lerp
            currentArcVec.x = p1Vec.x + (p2Vec.x - p1Vec.x) * f;
            currentArcVec.y = p1Vec.y + (p2Vec.y - p1Vec.y) * f;
            currentArcVec.z = p1Vec.z + (p2Vec.z - p1Vec.z) * f;
          }
        }


        // Ensure normalization and scaling happens correctly
        if (currentArcVec.lengthSq() > 0) { // Check if slerp/lerp resulted in a non-zero vector
             // slerp already normalizes, so just scale. Lerp needs normalization.
             currentArcVec.normalize().multiplyScalar(radius);
             arcForThree.push({ x: currentArcVec.x, y: currentArcVec.y, z: currentArcVec.z });
        } else {
            // If slerp/lerp results in zero vector (e.g. opposite points), use lerp as fallback
            const fallbackPt = new THREE.Vector3();
            fallbackPt.copy(p1Vec);
            // Explicitly call lerp via prototype
            if (typeof THREE.Vector3.prototype.lerp === 'function') {
                THREE.Vector3.prototype.lerp.call(fallbackPt, p2Vec,f);
            } else {
                console.error("THREE.Vector3.prototype.lerp is not a function for fallback!");
                fallbackPt.x = p1Vec.x + (p2Vec.x - p1Vec.x) * f;
                fallbackPt.y = p1Vec.y + (p2Vec.y - p1Vec.y) * f;
                fallbackPt.z = p1Vec.z + (p2Vec.z - p1Vec.z) * f;
            }
            fallbackPt.normalize().multiplyScalar(radius);
            arcForThree.push({ x: fallbackPt.x, y: fallbackPt.y, z: fallbackPt.z });
        }
      }
      // Convert THREE.Vector3[] back to Point3D[] for state
      setPathPoints(arcForThree);
    } else {
      setPathPoints([]);
    }
  }, [startNode, endNode, points, radius, nodes]); // nodes dependency for safety if node data influences path


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
