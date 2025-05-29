import type { NodeData, Position3D } from '@/types/graph';

/**
 * Calculates positions for nodes to arrange them on the surface of a sphere.
 * Uses the Fibonacci lattice (or golden angle) method for even distribution.
 * @param nodesToArrange Array of nodes to calculate positions for.
 * @param radius The radius of the sphere.
 * @param centerNodeId Optional ID of a node that should remain at the center (0,0,0).
 * @returns A new array of NodeData with updated 'position' properties.
 */
export const calculateNodePositions = (
  nodes: NodeData[],
  radius: number,
  centerNodeId?: string
): NodeData[] => {
  const nodesToArrange = nodes.filter(node => node.id !== centerNodeId);
  const N = nodesToArrange.length;
  if (N === 0 && !centerNodeId) return nodes;
  if (N === 0 && centerNodeId) {
     return nodes.map(node => 
      node.id === centerNodeId 
        ? { ...node, position: node.position || { x: 0, y: 0, z: 0 } } 
        : node
    );
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // Golden angle in radians

  const positionedNodes = nodes.map(node => {
    if (node.id === centerNodeId) {
      return { ...node, position: node.position || { x: 0, y: 0, z: 0 } };
    }
    
    const indexInArrangement = nodesToArrange.findIndex(n => n.id === node.id);
    if (indexInArrangement === -1) return node; // Should not happen if logic is correct

    // Distribute points on a sphere using Fibonacci lattice
    const y = 1 - (indexInArrangement / (N -1 + (N===1?1:0) )) * 2;  // y goes from 1 to -1 to avoid issues with N=1
    const r = Math.sqrt(1 - y * y); // radius at y
    const theta = goldenAngle * indexInArrangement; // golden angle increment

    const xPos = radius * r * Math.cos(theta);
    const yPos = radius * y;
    const zPos = radius * r * Math.sin(theta);
    
    return { ...node, position: { x: xPos, y: yPos, z: zPos } };
  });

  return positionedNodes;
};


/**
 * Reads a File object and converts it to a Base64 encoded data URI.
 * @param file The File object to read.
 * @returns A Promise that resolves with the data URI string.
 */
export const readFileAsDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Generates a unique ID.
 * @returns A unique string ID.
 */
export const generateUniqueId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};
