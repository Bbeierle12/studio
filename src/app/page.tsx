
'use client';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line as DreiLine } from '@react-three/drei'; // Renamed Line to DreiLine
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import * as THREE from 'three';
import { useToast } from "@/hooks/use-toast";

// Utility: Fibonacci sphere distribution for node placement
type Vec3 = THREE.Vector3;
function generateSpherePoints(count: number, radius: number): Vec3[] {
  const points: Vec3[] = [];
  if (count === 0) return points;
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2; // Handle single node case
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }
  return points;
}

// Pivot effect component to reorient camera and controls
type PivotProps = {
  selectedNode: number | null;
  points: Vec3[];
  radius: number;
  controlsRef: React.RefObject<OrbitControls & THREE.EventDispatcher & { target: THREE.Vector3 }>;
};
function PivotEffect({ selectedNode, points, radius, controlsRef }: PivotProps) {
  const { camera } = useThree();
  useEffect(() => {
    if (selectedNode !== null && controlsRef.current && points[selectedNode]) {
      const targetPoint = points[selectedNode].clone();
      const distance = radius * 2.5; // Increased distance for better view
      
      // Calculate new camera position: target point + (normalized target point * distance)
      // This places the camera further out along the vector from origin to target.
      const newCameraPosition = new THREE.Vector3();
      if (targetPoint.lengthSq() === 0) { // If target is at origin
        newCameraPosition.set(0,0,distance);
      } else {
        newCameraPosition.copy(targetPoint).normalize().multiplyScalar(distance);
      }

      camera.position.copy(newCameraPosition);
      controlsRef.current.target.copy(targetPoint);
      controlsRef.current.update();
    }
  }, [selectedNode, points, radius, camera, controlsRef]);
  return null;
}

interface Node {
  id: string;
  type?: string;
  url?: string;
  data?: any;
  title?: string; // Ensure title for Text display
}

export default function KnowledgeMap3D() {
  const [search, setSearch] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>(
    Array.from({ length: 10 }, (_, i) => ({ id: `Node ${i + 1}`, title: `Node ${i + 1}` }))
  );
  const [links, setLinks] = useState<[number, number][]>(() => {
    const initial: [number, number][] = [];
    if (nodes.length <=1) return initial; // No links if 0 or 1 node
    const maxLinks = Math.min(2, nodes.length -1); // Ensure maxLinks is not more than possible targets
    for (let i = 0; i < nodes.length; i++) {
      const targets = new Set<number>();
      while (targets.size < maxLinks) {
        const t = Math.floor(Math.random() * nodes.length);
        if (t !== i) targets.add(t);
      }
      targets.forEach((t) => initial.push([i, t]));
    }
    return initial;
  });

  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [startNode, setStartNode] = useState<number | null>(null);
  const [endNode, setEndNode] = useState<number | null>(null);
  const [pathPoints, setPathPoints] = useState<Vec3[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const radius = 10;
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  const controlsRef = useRef<OrbitControls & THREE.EventDispatcher & { target: THREE.Vector3 }>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsLoading(true);

    const newNodesBatch: Node[] = [];
    const newLinksBatch: [number, number][] = []; // Assuming links are by index initially

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File Error", description: `File too large: ${file.name}. Max ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)} MB.`, variant: "destructive" });
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const baseNodeLength = nodes.length + newNodesBatch.length;

      try {
        if (file.type === 'application/json' || ext === 'json') {
          const text = await file.text();
          const data = JSON.parse(text);
          if (Array.isArray(data.nodes)) {
             data.nodes.forEach((n: any) => newNodesBatch.push({ id: n.id || `jsonNode-${Date.now()}`, title: n.title || n.id || 'JSON Node', data: n.data, type: 'json'}));
          }
          if (Array.isArray(data.links)) {
            // Assuming links in JSON are {source: id, target: id}
            // This requires a post-processing step to map IDs to indices after all nodes are added
          }
          toast({ title: "File Processed", description: `${file.name} (JSON) parsed.` });
        }
        else if (['yaml', 'yml'].includes(ext)) {
          const text = await file.text();
          const data = yaml.load(text) as any;
          if (Array.isArray(data.nodes)) {
            data.nodes.forEach((n: any) => newNodesBatch.push({ id: n.id || `yamlNode-${Date.now()}`, title: n.title || n.id || 'YAML Node', data: n.data, type: 'yaml'}));
          }
          toast({ title: "File Processed", description: `${file.name} (YAML) parsed.` });
        }
        else if (file.type === 'text/csv' || ext === 'csv') {
          const text = await file.text();
          await new Promise<void>((resolve, reject) => {
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                results.data.forEach((row: any, i) => {
                  const nid = row.id || `Row${i + 1}-${Date.now()}`;
                  newNodesBatch.push({ id: nid, title: nid, data: row, type: 'csv' });
                  // Example for links in CSV: if row.links is "targetId1;targetId2"
                });
                resolve();
                toast({ title: "File Processed", description: `${file.name} (CSV) parsed.` });
              },
              error: (err) => reject(err),
            });
          });
        }
        else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ['xls', 'xlsx'].includes(ext)) {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(sheet);
          json.forEach((row, i) => {
             const nid = row.id || `SheetRow${i+1}-${Date.now()}`;
             newNodesBatch.push({ id: nid, title: nid, data: row, type: 'excel' });
          });
          toast({ title: "File Processed", description: `${file.name} (Excel) parsed.` });
        }
        else if (file.type.includes('xml') || ext === 'xml') {
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'application/xml');
          // Basic example: creates a node for each direct child of the root
          const rootChildren = Array.from(xmlDoc.documentElement.children);
          rootChildren.forEach((el, i) => {
            const nid = el.getAttribute('id') || el.tagName || `xmlNode${i}-${Date.now()}`;
            const nodeData: Record<string, string> = {};
            for(const attr of Array.from(el.attributes)) {
              nodeData[attr.name] = attr.value;
            }
            newNodesBatch.push({ id: nid, title: nid, data: {textContent: el.textContent, attributes: nodeData}, type: 'xml' });
          });
          toast({ title: "File Processed", description: `${file.name} (XML) parsed.` });
        }
        else if (file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          newNodesBatch.push({ id: file.name, title: file.name, type: 'pdf', url });
          newLinksBatch.push([baseNodeLength, 0]); // Link to first node (arbitrary)
          toast({ title: "File Processed", description: `${file.name} (PDF) added.` });
        }
        else if (file.type === 'text/plain' || ['md','txt'].includes(ext)) {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          lines.forEach((l, i) => newNodesBatch.push({id: `textLine-${i}-${Date.now()}`, title: l.substring(0,30) + (l.length > 30 ? '...' : ''), data: {content: l}, type: 'text'}));
          toast({ title: "File Processed", description: `${file.name} (Text) parsed.` });
        }
        else if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          newNodesBatch.push({ id: file.name, title: file.name, type: 'image', url });
          newLinksBatch.push([baseNodeLength, 0]);
          toast({ title: "File Processed", description: `${file.name} (Image) added.` });
        }
        else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          newNodesBatch.push({ id: file.name, title: file.name, type: ext, url });
          newLinksBatch.push([baseNodeLength, 0]);
          toast({ title: "File Processed", description: `${file.name} (Media) added.` });
        }
        else if (ext === 'zip') {
          const data = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(data);
          const zipFilePromises: Promise<void>[] = [];
          for (const entryName of Object.keys(zip.files)) {
            const entry = zip.files[entryName];
            if (!entry.dir) {
              zipFilePromises.push(
                entry.async('blob').then(blob => {
                  // Recursively call simplified file processing for zipped files
                  const zippedFile = new File([blob], entryName);
                  // Simulate a simplified event for recursive call
                  return handleFileUpload({ target: { files: [zippedFile] } } as any);
                })
              );
            }
          }
          await Promise.all(zipFilePromises);
          toast({ title: "File Processed", description: `${file.name} (ZIP) extracted and processed.` });
        }
        else {
          toast({ title: "Unsupported File", description: `Unsupported file type: ${file.name}`, variant: "destructive" });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        toast({ title: "Processing Error", description: `Could not process ${file.name}: ${(error as Error).message}`, variant: "destructive" });
      }
    }
    
    setNodes(prev => [...prev, ...newNodesBatch]);
    setLinks(prev => [...prev, ...newLinksBatch]); // Links are by index, ensure indices are correct

    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
    }
    setIsLoading(false);
  };

  const points = useMemo(() => generateSpherePoints(nodes.length, radius), [nodes.length, radius]);

  const handleNodeClick = (i: number) => {
    setSelectedNode(i);
    if (startNode === null || (startNode !==null && endNode !== null) ) { // If no start, or if path already set
      setStartNode(i);
      setEndNode(null);
      setPathPoints([]);
    } else if (endNode === null && i !== startNode) {
      setEndNode(i);
    }
  };
  
  const clearPath = () => {
    setStartNode(null);
    setEndNode(null);
    setPathPoints([]);
  }

  useEffect(() => {
    if (startNode !== null && endNode !== null && points[startNode] && points[endNode]) {
      const p1 = points[startNode].clone().normalize();
      const p2 = points[endNode].clone().normalize();
      const angle = p1.angleTo(p2); // Use angleTo for robustness
      const arc: Vec3[] = [];
      const steps = Math.max(2, Math.floor(angle * radius / 0.5)); // Adjust steps based on angle and radius

      if (Math.abs(angle) < 0.001) { // Points are very close or same
          setPathPoints([points[startNode], points[endNode]]);
          return;
      }
      if (Math.abs(angle - Math.PI) < 0.001) { // Points are opposite
          // Create a simple line for diametrically opposite points for now
          // A proper great circle arc calculation for this case might involve a third point or different quaternion logic
          setPathPoints([points[startNode], points[endNode]]);
          return;
      }

      const q1 = new THREE.Quaternion();
      const q2 = new THREE.Quaternion();
      const qm = new THREE.Quaternion();

      for (let t = 0; t <= steps; t++) {
        const f = t / steps;
        // Spherical linear interpolation (slerp) for Quaternions
        // For positions on sphere, can slerp vectors directly or use quaternions
        const tempVec = new THREE.Vector3();
        tempVec.copy(points[startNode]).slerp(points[endNode], f);
        arc.push(tempVec.normalize().multiplyScalar(radius)); // Ensure it stays on sphere surface
      }
      setPathPoints(arc);
    }
  }, [startNode, endNode, points, radius]);

  const matches = useMemo(() => {
    if (!search) return new Set<number>();
    const lowerSearch = search.toLowerCase();
    return new Set(
      nodes.reduce<number[]>((acc, n, idx) => {
        if (n.id.toLowerCase().includes(lowerSearch) || (n.title && n.title.toLowerCase().includes(lowerSearch))) acc.push(idx);
        return acc;
      }, [])
    );
  }, [search, nodes]);

  const displayedLinks = useMemo(() => {
    if (nodes.length === 0) return [];
    const validLinks = links.filter(([a,b]) => a < nodes.length && b < nodes.length);
    if (!search) return validLinks;
    return validLinks.filter(([a, b]) => matches.has(a) || matches.has(b));
  }, [search, matches, links, nodes.length]);


  // Node mesh component
  const NodeMesh = ({ position, data, highlight, index, isStart, isEnd }: {position: Vec3, data: Node, highlight: boolean, index: number, isStart?: boolean, isEnd?: boolean}) => {
    const groupRef = useRef<THREE.Group>(null);
    const { camera } = useThree();

    useFrame(() => {
      if (groupRef.current) {
        // Make sprite always face camera
         const textSprite = groupRef.current.getObjectByName("textSprite");
         if (textSprite) textSprite.quaternion.copy(camera.quaternion);
      }
    });

    let color = 'skyblue';
    if (isStart) color = 'lime';
    else if (isEnd) color = 'orange';
    else if (highlight) color = 'hotpink';

    return (
      <group position={position} ref={groupRef} onClick={() => handleNodeClick(index)}>
        <mesh>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.1}/>
        </mesh>
        <Text
            name="textSprite"
            position={[0, 0.5, 0]} // Position above the node
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="black"
          >
          {data.title || data.id}
        </Text>
        {data.url && data.type === 'image' && (
           <mesh position={[0, 0, 0.4]} 
             onPointerOver={() => document.body.style.cursor = 'pointer'}
             onPointerOut={() => document.body.style.cursor = 'auto'}
           >          
            <planeGeometry args={[0.5, 0.5]} />
            <meshBasicMaterial transparent side={THREE.DoubleSide}>
                <Suspense fallback={<meshBasicMaterial color="gray"/>}>
                    <TextureLoader url={data.url} />
                </Suspense>
            </meshBasicMaterial>
          </mesh>
        )}
      </group>
    );
  };

// Helper component to load texture for image nodes
function TextureLoader({ url }: {url:string}) {
  const texture = useMemo(() => new THREE.TextureLoader().load(url), [url]);
  return <primitive object={texture} attach="map" />;
}


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 shadow-md bg-card">
        <h1 className="text-2xl font-semibold text-foreground">
          Knowledge Map<span className="text-primary">3D</span>
        </h1>
      </header>
      <main className="flex-grow flex p-4 gap-4 overflow-hidden">
        <Card className="w-full md:w-1/4 lg:w-1/5 shadow-xl flex-shrink-0 overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-xl text-center">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
              aria-label="Search nodes"
            />
            <div className="relative">
              <Button onClick={() => fileInputRef.current?.click()} className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Upload Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".json,.pdf,.xml,.csv,.txt,.md,.yaml,.yml,.xls,.xlsx,.zip,image/*,audio/*,video/*"
                multiple
                onChange={handleFileUpload}
                disabled={isLoading}
              />
            </div>
             { (startNode !== null || endNode !==null) && 
                <Button onClick={clearPath} variant="outline" className="w-full">Clear Path Selection</Button>
             }
          </CardContent>
        </Card>

        <div className="flex-grow h-full bg-card rounded-lg shadow-lg relative">
          {/* Node details pane */}
          {selectedNode !== null && nodes[selectedNode] && (
            <Card className="absolute top-4 right-4 z-20 w-72 max-h-[calc(100%-2rem)] overflow-y-auto shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Node Details</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} aria-label="Close details">
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent>
                <h3 className="text-md font-semibold break-all">{nodes[selectedNode].title || nodes[selectedNode].id}</h3>
                <p className="text-sm text-muted-foreground">Type: {nodes[selectedNode].type || 'N/A'}</p>
                {nodes[selectedNode].url && nodes[selectedNode].type === 'image' && (
                  <img src={nodes[selectedNode].url} alt="preview" data-ai-hint="abstract texture" className="mt-2 max-w-full rounded" />
                )}
                 {nodes[selectedNode].url && nodes[selectedNode].type === 'pdf' && (
                  <a href={nodes[selectedNode].url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-primary hover:underline">Open PDF</a>
                )}
                {nodes[selectedNode].url && (nodes[selectedNode].type?.startsWith('audio/') || nodes[selectedNode].type?.startsWith('video/')) && (
                  <div className="mt-2">
                    {nodes[selectedNode].type?.startsWith('audio/') && <audio controls src={nodes[selectedNode].url} className="w-full" />}
                    {nodes[selectedNode].type?.startsWith('video/') && <video controls src={nodes[selectedNode].url} className="w-full rounded" />}
                  </div>
                )}
                {nodes[selectedNode].data && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer hover:text-primary">View Data</summary>
                    <pre className="mt-1 p-2 bg-muted/50 rounded text-xs whitespace-pre-wrap break-all max-h-60 overflow-auto">
                      {JSON.stringify(nodes[selectedNode].data, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3D Canvas */}
          <Canvas camera={{ position: [0, 0, radius * 2.5], fov: 50 }} style={{ background: 'hsl(var(--background))' }}>
            <ambientLight intensity={1.0} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight position={[-5, -5, -5]} intensity={0.3} />
            <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />
            {points.length > 0 && <PivotEffect selectedNode={selectedNode} points={points} radius={radius} controlsRef={controlsRef!} />}

            <Suspense fallback={null}> {/* Suspense for async components like Textures */}
              {nodes.map((node, i) => points[i] && ( // Check if points[i] exists
                <NodeMesh
                  key={`${node.id}-${i}`}
                  index={i}
                  position={points[i]}
                  data={node}
                  highlight={matches.has(i)}
                  isStart={i === startNode}
                  isEnd={i === endNode}
                />
              ))}
            </Suspense>

            {displayedLinks.map(([a, b], idx) => {
              if (!points[a] || !points[b]) return null; // Ensure points exist
              return (
                <DreiLine // Use DreiLine
                  key={`link-${idx}-${a}-${b}`}
                  points={[points[a], points[b]]}
                  lineWidth={1}
                  color={
                    (a === startNode && b === endNode) || (a === endNode && b === startNode)
                      ? 'yellow'
                      : matches.has(a) || matches.has(b)
                      ? 'hsl(var(--accent))'
                      : 'hsl(var(--primary))'
                  }
                  dashed={false}
                />
              );
            })}

            {pathPoints.length > 1 && (
              <DreiLine points={pathPoints} lineWidth={2.5} color="yellow" dashed={true} dashSize={0.2} gapSize={0.1} />
            )}
          </Canvas>
        </div>
      </main>
    </div>
  );
}

