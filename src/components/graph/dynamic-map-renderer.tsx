
'use client';

import React, { useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text as DreiText, Line as DreiLine } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

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
  const { camera } = useThree();
  useEffect(() => {
    const controls = controlsRef.current;
    if (selectedNode !== null && controls && points[selectedNode]) {
      const targetPoint3D = points[selectedNode];
      const targetPoint = new THREE.Vector3(targetPoint3D.x, targetPoint3D.y, targetPoint3D.z);
      const distance = radius * 2.5;
      
      const newCameraPosition = new THREE.Vector3();
      if (targetPoint.lengthSq() === 0) { 
        newCameraPosition.set(0, 0, distance);
      } else {
        newCameraPosition.copy(targetPoint).normalize().multiplyScalar(distance);
      }

      camera.position.lerp(newCameraPosition, 0.1);
      controls.target.lerp(targetPoint, 0.1);
      controls.update();
    }
  }, [selectedNode, points, radius, camera, controlsRef]);
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
  const controlsRef = useRef<OrbitControlsImpl>();

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
      const p1 = points[startNode];
      const p2 = points[endNode];
      const p1Vec = new THREE.Vector3(p1.x, p1.y, p1.z);
      const p2Vec = new THREE.Vector3(p2.x, p2.y, p2.z);
      
      const arcForThree: THREE.Vector3[] = [];
      // Ensure angle is not NaN if p1 or p2 are zero vectors, or identical
      const angle = (p1Vec.lengthSq() > 0 && p2Vec.lengthSq() > 0) ? p1Vec.angleTo(p2Vec) : 0;
      const steps = Math.max(2, Math.floor(angle * radius / 0.5)); 

      for (let t = 0; t <= steps; t++) {
        const f = t / steps;
        const pt = new THREE.Vector3().copy(p1Vec).slerp(p2Vec, f);
        if (pt.lengthSq() > 0) {
             arcForThree.push(pt.normalize().multiplyScalar(radius));
        } else { 
            // If slerp results in zero vector (e.g. opposite points), use lerp as fallback
            arcForThree.push(new THREE.Vector3().copy(p1Vec).lerp(p2Vec,f));
        }
      }
      setPathPoints(arcForThree.map(v => ({ x: v.x, y: v.y, z: v.z })));
    } else {
      setPathPoints([]); 
    }
  }, [startNode, endNode, points, radius, nodes]);


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

      <Suspense fallback={null}>
        {nodes.map((node, i) => points[i] && (
          <NodeMeshComponent
            key={`${node.id}-${i}-${node.title || i}`}
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
        if (!points[a] || !points[b]) return null;
        return (
          <DreiLine 
            key={`link-${idx}-${a}-${b}`}
            points={[[points[a].x, points[a].y, points[a].z], [points[b].x, points[b].y, points[b].z]]}
            lineWidth={1}
            color={
              matches.has(a) || matches.has(b)
                ? 'hsl(var(--accent))'
                : 'hsl(var(--primary))' 
            }
            dashed={false}
          />
        );
      })}

      {pathPoints.length > 1 && (
        <DreiLine 
            points={pathPoints.map(p => [p.x, p.y, p.z])} 
            lineWidth={2.5} color="yellow" dashed={true} dashSize={0.2} gapSize={0.1} />
      )}
    </Canvas>
  );
};

export default DynamicMapRenderer;
