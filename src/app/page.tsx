
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/layout/app-header';
import GraphControls from '@/components/controls/graph-controls';
import ThreeDeeCanvas from '@/components/graph/three-dee-canvas';
import type { NodeData, LinkData, GraphData } from '@/types/graph';
import { calculateNodePositions, readFileAsDataURI, generateUniqueId } from '@/lib/graph-utils';
import { generateLinksForPdf, type GenerateLinksForPdfInput } from '@/ai/flows/generate-links-for-pdf';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const CENTRAL_PDF_NODE_ID = 'central-pdf-node';
const SPHERE_RADIUS = 10;

const initialPdfAnchorNode: NodeData = {
  id: CENTRAL_PDF_NODE_ID,
  title: 'My Uploaded Documents',
  type: 'central',
  position: { x: 0, y: 0, z: 0 },
  color: '#FFD700' // Gold color for central node
};

export default function Home() {
  const [nodes, setNodes] = useState<NodeData[]>([initialPdfAnchorNode]);
  const [links, setLinks] = useState<LinkData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<Set<string>>(new Set());
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const { toast } = useToast();

  const updateNodePositions = useCallback((currentNodes: NodeData[]) => {
    // Nodes that are not the central PDF node will be arranged.
    // The central PDF node's position is fixed at origin if it exists.
    return calculateNodePositions(currentNodes, SPHERE_RADIUS, CENTRAL_PDF_NODE_ID);
  }, []);
  
  useEffect(() => {
    setNodes(prevNodes => updateNodePositions(prevNodes));
  }, [links.length, updateNodePositions]); // Re-calculate positions when structure might change


  const handleJsonUpload = async (file: File) => {
    try {
      const fileContent = await file.text();
      const graphData = JSON.parse(fileContent) as GraphData; 

      if (!graphData.nodes || !graphData.links) {
        throw new Error("Invalid JSON format: 'nodes' and 'links' arrays are required.");
      }
      
      const existingIds = new Set(nodes.map(n => n.id));
      const newNodes = graphData.nodes.filter(n => !existingIds.has(n.id) && n.id !== CENTRAL_PDF_NODE_ID);
      const newLinks = graphData.links.filter(l => {
        const sourceExists = existingIds.has(l.source) || newNodes.find(n => n.id === l.source);
        const targetExists = existingIds.has(l.target) || newNodes.find(n => n.id === l.target);
        return sourceExists && targetExists;
      });

      setNodes(prevNodes => updateNodePositions([...prevNodes, ...newNodes]));
      setLinks(prevLinks => [...prevLinks, ...newLinks]);
      toast({ title: "JSON data loaded", description: `${newNodes.length} nodes and ${newLinks.length} links added.` });
    } catch (error) {
      console.error("Error processing JSON file:", error);
      toast({ title: "Error loading JSON", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handlePdfUpload = async (file: File) => {
    setIsLoadingAI(true);
    try {
      const pdfDataUri = await readFileAsDataURI(file);
      const pdfNodeId = generateUniqueId();
      const pdfNode: NodeData = {
        id: pdfNodeId,
        title: file.name,
        type: 'pdf',
        content: pdfDataUri, 
      };

      const linkToCentral: LinkData = {
        id: `${CENTRAL_PDF_NODE_ID}-${pdfNodeId}`,
        source: CENTRAL_PDF_NODE_ID,
        target: pdfNodeId,
      };
      
      const updatedNodesWithPdf = updateNodePositions([...nodes, pdfNode]);
      setNodes(updatedNodesWithPdf);
      setLinks(prevLinks => [...prevLinks, linkToCentral]);

      toast({ title: "PDF uploaded", description: `Node "${file.name}" added. Generating AI links...` });

      const aiInput: GenerateLinksForPdfInput = {
        pdfDataUri,
        existingNodeTitles: updatedNodesWithPdf.filter(n => n.id !== pdfNodeId && n.id !== CENTRAL_PDF_NODE_ID).map(n => n.title),
      };
      
      if (aiInput.existingNodeTitles.length > 0) {
        const aiResult = await generateLinksForPdf(aiInput);
        const aiLinks: LinkData[] = aiResult.suggestedLinks.map(suggestedLink => {
          const targetNode = updatedNodesWithPdf.find(n => n.title === suggestedLink.targetNodeTitle);
          if (targetNode) {
            return {
              id: `${pdfNodeId}-${targetNode.id}`,
              source: pdfNodeId,
              target: targetNode.id,
              reason: suggestedLink.reason,
              color: '#2ecc71' 
            };
          }
          return null;
        }).filter(link => link !== null) as LinkData[];

        if (aiLinks.length > 0) {
          setLinks(prevLinks => [...prevLinks, ...aiLinks]);
          toast({ title: "AI Links Generated", description: `${aiLinks.length} new links suggested for "${file.name}".` });
        } else {
          toast({ title: "AI Links", description: `No new links suggested by AI for "${file.name}".` });
        }
      } else {
         toast({ title: "AI Links Skipped", description: "No other existing nodes to link the PDF to (besides the central anchor)." });
      }

    } catch (error) {
      console.error("Error processing PDF file:", error);
      toast({ title: "Error processing PDF", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleClearMap = () => {
    setNodes([initialPdfAnchorNode]);
    setLinks([]);
    setSearchTerm('');
    setHighlightedNodeIds(new Set());
    setHighlightedLinkIds(new Set());
    toast({ title: "Map Cleared", description: "The knowledge map has been reset." });
  };
  
  useEffect(() => {
    if (searchTerm === '') {
      setHighlightedNodeIds(new Set());
      setHighlightedLinkIds(new Set());
      return;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const newHighlightedNodeIds = new Set<string>();
    nodes.forEach(node => {
      if (node.title.toLowerCase().includes(lowerSearchTerm)) {
        newHighlightedNodeIds.add(node.id);
      }
    });

    const newHighlightedLinkIds = new Set<string>();
    links.forEach(link => {
      if (newHighlightedNodeIds.has(link.source) || newHighlightedNodeIds.has(link.target)) {
        newHighlightedLinkIds.add(link.id);
        if (newHighlightedNodeIds.has(link.source) && !newHighlightedNodeIds.has(link.target)) {
          newHighlightedNodeIds.add(link.target);
        }
        if (newHighlightedNodeIds.has(link.target) && !newHighlightedNodeIds.has(link.source)) {
          newHighlightedNodeIds.add(link.source);
        }
      }
    });
    
    setHighlightedNodeIds(newHighlightedNodeIds);
    setHighlightedLinkIds(newHighlightedLinkIds);

  }, [searchTerm, nodes, links]);


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
        <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
          <GraphControls
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onJsonUpload={handleJsonUpload}
            onPdfUpload={handlePdfUpload}
            onClearMap={handleClearMap}
          />
          {isLoadingAI && (
            <div className="mt-4 p-4 bg-card rounded-md flex items-center justify-center text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI is thinking...
            </div>
          )}
        </div>
        <div className="flex-grow h-full md:h-auto min-h-[300px] md:min-h-0 bg-card rounded-lg shadow-lg overflow-hidden">
          <ThreeDeeCanvas 
            nodes={nodes} 
            links={links} 
            highlightedNodeIds={highlightedNodeIds}
            highlightedLinkIds={highlightedLinkIds}
          />
        </div>
      </main>
    </div>
  );
}
