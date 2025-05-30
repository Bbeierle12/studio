
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
  const phi = Math.PI * (3 - Math.sqrt(5)); 
  for (let i = 0; i < count; i++) {
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

interface DynamicMapRendererProps {
  nodes?: Node[];
  links?: [number, number][];
  highlightedIndices?: Set<number>;
  selectedNode?: number | null;
  startNode?: number | null;
  endNode?: number | null;
  radius?: number;
  onNodeClick?: (index: number) => void;
}

const DynamicMapRenderer: React.FC<DynamicMapRendererProps> = ({
  nodes = [],
  links = [],
  highlightedIndices = new Set<number>(),
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

  const displayedLinks = useMemo(() => {
    if (nodes.length === 0) return [];
    const validLinks = links.filter(([a,b]) => a >= 0 && a < nodes.length && b >= 0 && b < nodes.length && a !== b );

    if (highlightedIndices.size > 0) { 
      return validLinks.filter(([a, b]) => highlightedIndices.has(a) || highlightedIndices.has(b));
    }
    return validLinks; 
  }, [highlightedIndices, links, nodes]);


  const [pathPoints, setPathPoints] = React.useState<Point3D[]>([]);

  useEffect(() => {
    if (startNode !== null && endNode !== null && points[startNode] && points[endNode]) {
      const p1 = points[startNode]; 
      const p2 = points[endNode]; 

      const p1Vec = new THREE.Vector3(p1.x, p1.y, p1.z).normalize();
      const p2Vec = new THREE.Vector3(p2.x, p2.y, p2.z).normalize();
      
      const arcForThree: Point3D[] = [];
      const theta = Math.acos(THREE.MathUtils.clamp(p1Vec.dot(p2Vec), -1, 1)); 
      const steps = Math.max(2, Math.floor(theta * radius / 0.5) || 32); 

      if (Math.abs(theta) < 0.0001 || Math.abs(Math.sin(theta)) < 0.0001) {
        for (let t = 0; t <= steps; t++) {
          const f = t / steps;
          const lerpVec = new THREE.Vector3().lerpVectors(p1Vec, p2Vec, f);
          lerpVec.normalize().multiplyScalar(radius); 
          arcForThree.push({ x: lerpVec.x, y: lerpVec.y, z: lerpVec.z });
        }
      } else {
        const sinTheta = Math.sin(theta);
        for (let t = 0; t <= steps; t++) {
          const f = t / steps;
          const c1 = Math.sin((1 - f) * theta) / sinTheta;
          const c2 = Math.sin(f * theta) / sinTheta;

          // Manual slerp component-wise
          const arcX = c1 * p1Vec.x + c2 * p2Vec.x;
          const arcY = c1 * p1Vec.y + c2 * p2Vec.y;
          const arcZ = c1 * p1Vec.z + c2 * p2Vec.z;
          
          const arcVec = new THREE.Vector3(arcX, arcY, arcZ);
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
            position={[0, 0.5, 0]} 
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01} 
            outlineColor="#333333"
          >
          {data.title || data.id}
        </DreiText>
        {data.url && data.type === 'image' && (
           <mesh position={[0, 0, 0.4]} rotation={[0, Math.PI, 0]}> 
            <planeGeometry args={[0.5, 0.5]} /> 
            <meshBasicMaterial transparent side={THREE.DoubleSide}> 
                <Suspense fallback={null}> 
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
      style={{ background: 'hsl(var(--background))', touchAction: 'none' }} 
      onPointerMissed={(event) => {
        if (event.target === event.currentTarget) {
           onNodeClick(-1); 
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

      <Suspense fallback={null}> 
        {nodes.map((node, i) => points[i] && (
          <NodeMeshComponent
            key={`${node.id}-${i}-${node.title || i}`} 
            index={i}
            position={points[i]}
            data={node}
            highlight={highlightedIndices.has(i)}
            isStart={i === startNode}
            isEnd={i === endNode}
            onClick={onNodeClick}
          />
        ))}
      </Suspense>

      {displayedLinks.map(([a, b], idx) => {
        if (!points[a] || !points[b]) return null; 
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
              (highlightedIndices.has(a) || highlightedIndices.has(b))
                ? 'hsl(var(--accent))'
                : 'hsl(var(--primary))'
            }
            dashed={false}
          />
        );
      })}

      {pathPoints.length > 1 && (
        <DreiLine
            points={pathPoints.map(p => [p.x, p.y, p.z] as THREE.Vector3Tuple)} 
            lineWidth={2.5} color="yellow" dashed={true} dashSize={0.2} gapSize={0.1} />
      )}
    </Canvas>
  );
};

export default DynamicMapRenderer;
