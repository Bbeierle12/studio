
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import { Loader2, XCircle, UploadCloud, SearchIcon } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';

// Node type (can be moved to a shared types file if used elsewhere)
interface Node {
  id: string;
  type?: string;
  url?: string;
  data?: any;
  title?: string;
}

const DynamicMapRenderer = dynamic(() => import('@/components/graph/dynamic-map-renderer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg shadow-inner">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg text-foreground">Loading 3D Map...</p>
    </div>
  ),
});


export default function KnowledgeMap3D() {
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [search, setSearch] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>(
    Array.from({ length: 10 }, (_, i) => ({ id: `Node ${i + 1}`, title: `Node ${i + 1}`, type: 'default' }))
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
  const [isLoading, setIsLoading] = useState(false);

  const radius = 10; // This can be a prop for DynamicMapRenderer if needed
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
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
        console.error(`File too large: ${file.name}. Max ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)} MB.`);
        alert(`File too large: ${file.name}. Max ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)} MB.`);
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
          console.log(`${file.name} (JSON) parsed.`);
        }
        else if (['yaml', 'yml'].includes(ext)) {
          const text = await file.text();
          const data = yaml.load(text) as any;
          if (Array.isArray(data.nodes)) {
            data.nodes.forEach((n: any) => fileNodes.push({ id: n.id || `yamlNode-${Date.now()}`, title: n.title || n.id || 'YAML Node', data: n.data, type: 'yaml'}));
          }
          console.log(`${file.name} (YAML) parsed.`);
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
                console.log(`${file.name} (CSV) parsed.`);
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
          console.log(`${file.name} (Excel) parsed.`);
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
          console.log(`${file.name} (XML) parsed.`);
        }
        else if (file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          fileNodes.push({ id: file.name, title: file.name, type: 'pdf', url });
          if (nodes.length + newNodesBatch.length + fileNodes.length > 1) { // Link to first node if others exist
            fileLinks.push([newNodeBaseIdx, 0]); 
          }
          console.log(`${file.name} (PDF) added.`);
        }
        else if (file.type === 'text/plain' || ['md','txt'].includes(ext)) {
          const text = await file.text();
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          lines.forEach((l, i) => fileNodes.push({id: `textLine-${i}-${Date.now()}`, title: l.substring(0,30) + (l.length > 30 ? '...' : ''), data: {content: l}, type: 'text'}));
          console.log(`${file.name} (Text) parsed.`);
        }
        else if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          fileNodes.push({ id: file.name, title: file.name, type: 'image', url });
           if (nodes.length + newNodesBatch.length + fileNodes.length > 1) { // Link to first node
            fileLinks.push([newNodeBaseIdx, 0]);
          }
          console.log(`${file.name} (Image) added.`);
        }
        else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          fileNodes.push({ id: file.name, title: file.name, type: ext, url });
           if (nodes.length + newNodesBatch.length + fileNodes.length > 1) { // Link to first node
            fileLinks.push([newNodeBaseIdx, 0]);
          }
          console.log(`${file.name} (Media) added.`);
        }
        else if (ext === 'zip') {
          const data = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(data);
          const zipFilePromises: Promise<{nodes: Node[], links: [number,number][]}>[] = [];
          let nestedBaseIndex = newNodeBaseIdx + fileNodes.length; // Keep track of index for nested files
          for (const entryName of Object.keys(zip.files)) {
            const entry = zip.files[entryName];
            if (!entry.dir) {
              zipFilePromises.push(
                entry.async('blob').then(async blob => {
                  const zippedFile = new File([blob], entryName, { type: blob.type });
                  // Pass the current base index for nested processing
                  const result = await processFile(zippedFile, nestedBaseIndex);
                  // Update base index for the next nested file based on nodes added by current one
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
          console.log(`${file.name} (ZIP) extracted and processed.`);
        }
        else {
          console.error(`Unsupported file type: ${file.name}`);
          alert(`Unsupported file type: ${file.name}`);
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        alert(`Could not process ${file.name}: ${(error as Error).message}`);
      }
      return { nodes: fileNodes, links: fileLinks };
    };

    let currentTotalNodes = nodes.length; // Base index for new nodes from current batch of files
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

  const handleNodeClick = (i: number) => {
    if (i === -1) { 
      setSelectedNode(null);
      // Optionally, also clear path selection if a click outside deselects nodes.
      // setStartNode(null);
      // setEndNode(null);
      return;
    }
    setSelectedNode(i);
    if (startNode === null || (startNode !== null && endNode !== null)) {
      setStartNode(i);
      setEndNode(null);
    } else if (endNode === null && i !== startNode) {
      setEndNode(i);
    }
  };
  
  const clearPath = () => {
    setStartNode(null);
    setEndNode(null);
  };

  const clearMap = () => {
    setNodes( Array.from({ length: 1 }, (_, i) => ({ id: `Node ${i + 1}`, title: `Node ${i + 1}`, type: 'default' })));
    setLinks([]);
    setSelectedNode(null);
    setStartNode(null);
    setEndNode(null);
    setSearch('');
    console.log("Map Cleared: The knowledge map has been reset.");
    alert("Map Cleared: The knowledge map has been reset.");
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

          {isClientMounted ? (
            <DynamicMapRenderer
              nodes={nodes}
              links={links}
              search={search}
              selectedNode={selectedNode}
              startNode={startNode}
              endNode={endNode}
              radius={radius}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg shadow-inner">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-foreground">Initializing Map...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
