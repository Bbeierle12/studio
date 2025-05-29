
'use client';

import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text as DreiText, Line as DreiLine } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import * as THREE from 'three';
import { useToast } from "@/hooks/use-toast";
import { Loader2, XCircle, UploadCloud, SearchIcon } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';

// Node and Link types
interface Node {
  id: string;
  type?: string;
  url?: string;
  data?: any;
  title?: string;
}

type Vec3 = THREE.Vector3;

// Utility: Fibonacci sphere distribution for node placement
function generateSpherePoints(count: number, radius: number): Vec3[] {
  const points: Vec3[] = [];
  if (count === 0) return points;
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle in radians
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
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
  controlsRef: React.RefObject<OrbitControlsImpl | undefined>;
};
function PivotEffect({ selectedNode, points, radius, controlsRef }: PivotProps) {
  const { camera } = useThree();
  useEffect(() => {
    if (selectedNode !== null && controlsRef.current && points[selectedNode]) {
      const targetPoint = points[selectedNode].clone();
      const distance = radius * 2.5;
      
      const newCameraPosition = new THREE.Vector3();
      if (targetPoint.lengthSq() === 0) {
        newCameraPosition.set(0, 0, distance);
      } else {
        newCameraPosition.copy(targetPoint).normalize().multiplyScalar(distance);
      }

      camera.position.lerp(newCameraPosition, 0.1);
      controlsRef.current.target.lerp(targetPoint, 0.1);
      controlsRef.current.update();
    }
  }, [selectedNode, points, radius, camera, controlsRef]);
  return null;
}

// Helper component to load texture for image nodes
function TextureLoaderHelper({ url }: { url: string }) {
  const texture = useMemo(() => new THREE.TextureLoader().load(url), [url]);
  return <primitive object={texture} attach="map" />;
}


export default function KnowledgeMap3D() {
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [search, setSearch] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>(
    Array.from({ length: 10 }, (_, i) => ({ id: `Node ${i + 1}`, title: `Node ${i + 1}` }))
  );
  const [links, setLinks] = useState<[number, number][]>(() => {
    const initialLinks: [number, number][] = [];
    if (nodes.length <=1) return initialLinks;
    const maxLinksPerNode = Math.min(2, nodes.length -1);
    for (let i = 0; i < nodes.length; i++) {
      const targets = new Set<number>();
      while (targets.size < maxLinksPerNode && targets.size < nodes.length -1) {
        const t = Math.floor(Math.random() * nodes.length);
        if (t !== i) targets.add(t);
      }
      targets.forEach((t) => initialLinks.push([i, t]));
    }
    return initialLinks;
  });

  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [startNode, setStartNode] = useState<number | null>(null);
  const [endNode, setEndNode] = useState<number | null>(null);
  const [pathPoints, setPathPoints] = useState<Vec3[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const radius = 10;
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  const controlsRef = useRef<OrbitControlsImpl>();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  const handleFileUpload = async (eventOrFiles: React.ChangeEvent<HTMLInputElement> | File[]) => {
    const files = Array.isArray(eventOrFiles) ? eventOrFiles : Array.from(eventOrFiles.target.files || []);
    if (files.length === 0) return;
    
    setIsLoading(true);
    const newNodesBatch: Node[] = [];
    const newLinksBatch: [number, number][] = [];

    const processFile = async (file: File, currentBaseNodeIndex: number): Promise<{nodes: Node[], links: [number, number][]}> => {
      const fileNodes: Node[] = [];
      const fileLinks: [number, number][] = [];
      
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File Error", description: `File too large: ${file.name}. Max ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)} MB.`, variant: "destructive" });
        return {nodes: [], links: []};
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const newNodeBaseIdx = currentBaseNodeIndex + fileNodes.length;

      try {
        if (file.type === 'application/json' || ext === 'json') {
          const text = await file.text();
          const data = JSON.parse(text);
          if (Array.isArray(data.nodes)) {
             data.nodes.forEach((n: any) => fileNodes.push({ id: n.id || `jsonNode-${Date.now()}`, title: n.title || n.id || 'JSON Node', data: n.data, type: 'json'}));
          }
          toast({ title: "File Processed", description: `${file.name} (JSON) parsed.` });
        }
        else if (['yaml', 'yml'].includes(ext)) {
          const text = await file.text();
          const data = yaml.load(text) as any;
          if (Array.isArray(data.nodes)) {
            data.nodes.forEach((n: any) => fileNodes.push({ id: n.id || `yamlNode-${Date.now()}`, title: n.title || n.id || 'YAML Node', data: n.data, type: 'yaml'}));
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
                  fileNodes.push({ id: nid, title: row.title || nid, data: row, type: 'csv' });
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
             fileNodes.push({ id: nid, title: row.title || nid, data: row, type: 'excel' });
          });
          toast({ title: "File Processed", description: `${file.name} (Excel) parsed.` });
        }
        else if (file.type.includes('xml') || ext === 'xml') {
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'application/xml');
          const rootChildren = Array.from(xmlDoc.documentElement.children);
          rootChildren.forEach((el, i) => {
            const nid = el.getAttribute('id') || el.tagName || `xmlNode${i}-${Date.now()}`;
            const nodeData: Record<string, string> = {};
            for(const attr of Array.from(el.attributes)) {
              nodeData[attr.name] = attr.value;
            }
            fileNodes.push({ id: nid, title: el.getAttribute('title') || nid, data: {textContent: el.textContent, attributes: nodeData}, type: 'xml' });
          });
          toast({ title: "File Processed", description: `${file.name} (XML) parsed.` });
        }
        else if (file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          fileNodes.push({ id: file.name, title: file.name, type: 'pdf', url });
          if (nodes.length + newNodesBatch.length + fileNodes.length > 1) {
            fileLinks.push([newNodeBaseIdx, 0]); 
          }
          toast({ title: "File Processed", description: `${file.name} (PDF) added.` });
        }
        else if (file.type === 'text/plain' || ['md','txt'].includes(ext)) {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          lines.forEach((l, i) => fileNodes.push({id: `textLine-${i}-${Date.now()}`, title: l.substring(0,30) + (l.length > 30 ? '...' : ''), data: {content: l}, type: 'text'}));
          toast({ title: "File Processed", description: `${file.name} (Text) parsed.` });
        }
        else if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          fileNodes.push({ id: file.name, title: file.name, type: 'image', url });
           if (nodes.length + newNodesBatch.length + fileNodes.length > 1) {
            fileLinks.push([newNodeBaseIdx, 0]);
          }
          toast({ title: "File Processed", description: `${file.name} (Image) added.` });
        }
        else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          fileNodes.push({ id: file.name, title: file.name, type: ext, url });
           if (nodes.length + newNodesBatch.length + fileNodes.length > 1) {
            fileLinks.push([newNodeBaseIdx, 0]);
          }
          toast({ title: "File Processed", description: `${file.name} (Media) added.` });
        }
        else if (ext === 'zip') {
          const data = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(data);
          const zipFilePromises: Promise<{nodes: Node[], links: [number,number][]}>[] = [];
          let nestedBaseIndex = newNodeBaseIdx + fileNodes.length;
          for (const entryName of Object.keys(zip.files)) {
            const entry = zip.files[entryName];
            if (!entry.dir) {
              zipFilePromises.push(
                entry.async('blob').then(async blob => {
                  const zippedFile = new File([blob], entryName, { type: blob.type });
                  const result = await processFile(zippedFile, nestedBaseIndex);
                  nestedBaseIndex += result.nodes.length;
                  return result;
                })
              );
            }
          }
          const results = await Promise.all(zipFilePromises);
          results.forEach(r => {
            fileNodes.push(...r.nodes);
            fileLinks.push(...r.links);
          });
          toast({ title: "File Processed", description: `${file.name} (ZIP) extracted and processed.` });
        }
        else {
          toast({ title: "Unsupported File", description: `Unsupported file type: ${file.name}`, variant: "destructive" });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        toast({ title: "Processing Error", description: `Could not process ${file.name}: ${(error as Error).message}`, variant: "destructive" });
      }
      return { nodes: fileNodes, links: fileLinks };
    };

    let currentTotalNodes = nodes.length;
    for (const file of files) {
      const result = await processFile(file, currentTotalNodes + newNodesBatch.length);
      newNodesBatch.push(...result.nodes);
      newLinksBatch.push(...result.links);
    }
    
    setNodes(prev => [...prev, ...newNodesBatch]);
    setLinks(prev => [...prev, ...newLinksBatch]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsLoading(false);
  };


  const points = useMemo(() => generateSpherePoints(nodes.length, radius), [nodes.length, radius]);

  const handleNodeClick = (i: number) => {
    setSelectedNode(i);
    if (startNode === null || (startNode !== null && endNode !== null)) {
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
  };

  const clearMap = () => {
    setNodes( Array.from({ length: 1 }, (_, i) => ({ id: `Node ${i + 1}`, title: `Node ${i + 1}` })));
    setLinks([]);
    setSelectedNode(null);
    setStartNode(null);
    setEndNode(null);
    setPathPoints([]);
    setSearch('');
    toast({ title: "Map Cleared", description: "The knowledge map has been reset." });
  };

  useEffect(() => {
    if (startNode !== null && endNode !== null && points[startNode] && points[endNode]) {
      const p1 = points[startNode].clone();
      const p2 = points[endNode].clone();
      const arc: Vec3[] = [];
      const steps = Math.max(2, Math.floor(p1.angleTo(p2) * radius / 0.5)); 

      for (let t = 0; t <= steps; t++) {
        const f = t / steps;
        const pt = new THREE.Vector3().copy(p1).slerp(p2, f);
        if (pt.lengthSq() > 0) {
             arc.push(pt.normalize().multiplyScalar(radius));
        } else { 
            arc.push(new THREE.Vector3().copy(p1).lerp(p2,f));
        }
      }
      setPathPoints(arc);
    }
  }, [startNode, endNode, points, radius]);

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
    const validLinks = links.filter(([a,b]) => a >= 0 && a < nodes.length && b >= 0 && b < nodes.length && a !==b );
    if (!search) return validLinks;
    return validLinks.filter(([a, b]) => matches.has(a) || matches.has(b));
  }, [search, matches, links, nodes.length]);


  const NodeMesh = ({ position, data, highlight, index, isStart, isEnd }: {position: Vec3, data: Node, highlight: boolean, index: number, isStart?: boolean, isEnd?: boolean}) => {
    let color = 'hsl(var(--primary))';
    if (isStart) color = 'lime';
    else if (isEnd) color = 'orange';
    else if (highlight) color = 'hsl(var(--accent))';

    return (
      <group position={position} onClick={(e) => { e.stopPropagation(); handleNodeClick(index);}}>
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
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow flex p-4 gap-4 overflow-hidden">
        <Card className="w-full md:w-1/3 lg:w-1/4 xl:w-1/5 shadow-xl flex-shrink-0 overflow-y-auto bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-xl text-center">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10"
                aria-label="Search nodes"
              />
            </div>
            <div className="relative">
              <Button onClick={() => fileInputRef.current?.click()} className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
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
             <Button onClick={clearMap} variant="destructive" className="w-full">
                Clear Map
             </Button>
          </CardContent>
        </Card>

        <div className="flex-grow h-full bg-muted/20 rounded-lg shadow-lg relative">
          {selectedNode !== null && nodes[selectedNode] && (
            <Card className="absolute top-4 right-4 z-20 w-80 max-h-[calc(100%-2rem)] overflow-y-auto shadow-2xl bg-card text-card-foreground">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{nodes[selectedNode].title || nodes[selectedNode].id}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} aria-label="Close details">
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-1">ID: <span className="font-mono text-xs">{nodes[selectedNode].id}</span></p>
                <p className="text-sm text-muted-foreground">Type: {nodes[selectedNode].type || 'N/A'}</p>
                {nodes[selectedNode].url && nodes[selectedNode].type === 'image' && (
                  <img src={nodes[selectedNode].url} alt={nodes[selectedNode].title || "preview"} data-ai-hint="abstract render" className="mt-2 max-w-full rounded" />
                )}
                 {nodes[selectedNode].url && nodes[selectedNode].type === 'pdf' && (
                  <a href={nodes[selectedNode].url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-primary hover:underline">Open PDF</a>
                )}
                {nodes[selectedNode].url && (nodes[selectedNode].type?.startsWith('audio') || nodes[selectedNode].type?.startsWith('video')) && (
                  <div className="mt-2">
                    {nodes[selectedNode].type?.startsWith('audio') && <audio controls src={nodes[selectedNode].url} className="w-full" />}
                    {nodes[selectedNode].type?.startsWith('video') && <video controls src={nodes[selectedNode].url} className="w-full rounded" />}
                  </div>
                )}
                {nodes[selectedNode].data && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer hover:text-primary">View Raw Data</summary>
                    <pre className="mt-1 p-2 bg-muted/30 rounded text-xs whitespace-pre-wrap break-all max-h-60 overflow-auto">
                      {JSON.stringify(nodes[selectedNode].data, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          {isClientMounted && (
            <Canvas 
              shadows 
              camera={{ position: [0, 0, radius * 2.5], fov: 50 }} 
              style={{ background: 'hsl(var(--background))' }}
              onPointerMissed={() => setSelectedNode(null)}
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
              
              {points.length > 0 && <PivotEffect selectedNode={selectedNode} points={points} radius={radius} controlsRef={controlsRef} />}

              <Suspense fallback={null}>
                {nodes.map((node, i) => points[i] && (
                  <NodeMesh
                    key={`${node.id}-${i}-${node.title}`}
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
                if (!points[a] || !points[b]) return null;
                return (
                  <DreiLine 
                    key={`link-${idx}-${a}-${b}`}
                    points={[points[a], points[b]]}
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
                <DreiLine points={pathPoints} lineWidth={2.5} color="yellow" dashed={true} dashSize={0.2} gapSize={0.1} />
              )}
            </Canvas>
          )}
          {!isClientMounted && (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
