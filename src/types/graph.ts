export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface NodeData {
  id: string;
  title: string;
  type: 'central' | 'pdf' | 'json' | 'default';
  content?: string; // For PDF data URI or other content
  position?: Position3D;
  color?: string; // Optional: for specific node coloring
}

export interface LinkData {
  id: string; // Unique ID for the link, e.g., sourceId-targetId
  source: string; // ID of the source node
  target: string; // ID of the target node
  reason?: string; // Optional: reason for the link (e.g., from AI)
  color?: string; // Optional: for specific link coloring
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}
