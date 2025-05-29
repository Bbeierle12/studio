'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { NodeData, LinkData, Position3D } from '@/types/graph';

interface ThreeDeeCanvasProps {
  nodes: NodeData[];
  links: LinkData[];
  highlightedNodeIds: Set<string>;
  highlightedLinkIds: Set<string>;
  accentColor?: string; // hex string e.g. '#f368e0'
  defaultNodeColor?: string; // hex string
  defaultLinkColor?: string; // hex string
}

const ThreeDeeCanvas: React.FC<ThreeDeeCanvasProps> = ({
  nodes,
  links,
  highlightedNodeIds,
  highlightedLinkIds,
  accentColor = '#f368e0', // Hot Pink
  defaultNodeColor = '#3498db', // Deep Sky Blue
  defaultLinkColor = '#7f8c8d', // Muted Gray
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const linkMeshesRef = useRef<Map<string, THREE.Line>>(new Map());
  const textSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map());

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (mountRef.current) {
      setDimensions({
        width: mountRef.current.clientWidth,
        height: mountRef.current.clientHeight,
      });
    }
  }, []);

  // Create text texture
  const createTextTexture = (text: string, color = 'rgba(255, 255, 255, 0.8)', fontSize = 32, bgColor = 'rgba(0,0,0,0.3)') => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    const lines = text.split('\\n');
    const font = `${fontSize}px Arial`;
    context.font = font;
    
    let maxWidth = 0;
    lines.forEach(line => {
      maxWidth = Math.max(maxWidth, context.measureText(line).width);
    });
    
    const textHeight = fontSize * lines.length + (lines.length -1) * (fontSize * 0.2);
    const padding = fontSize / 2;

    canvas.width = THREE.MathUtils.ceilPowerOfTwo(maxWidth + padding * 2);
    canvas.height = THREE.MathUtils.ceilPowerOfTwo(textHeight + padding * 2);
    
    context.font = font; // Set font again after resize
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    const centerX = canvas.width / 2;
    const startY = canvas.height / 2 - (textHeight / 2) + (fontSize / 2);

    lines.forEach((line, index) => {
      context.fillText(line, centerX, startY + index * (fontSize * 1.2));
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { texture, width: canvas.width, height: canvas.height };
  };


  // Initialize THREE.js scene
  useEffect(() => {
    if (!mountRef.current || dimensions.width === 0 || dimensions.height === 0) return;
    if (rendererRef.current) return; // Already initialized

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x34495e); // Dark Gray

    const camera = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.1, 1000);
    camera.position.z = 15;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (mountRef.current && rendererRef.current && cameraRef.current) {
        const newWidth = mountRef.current.clientWidth;
        const newHeight = mountRef.current.clientHeight;
        setDimensions({ width: newWidth, height: newHeight });
        rendererRef.current.setSize(newWidth, newHeight);
        cameraRef.current.aspect = newWidth / newHeight;
        cameraRef.current.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      controlsRef.current?.dispose();
      // Dispose geometries, materials, textures from meshes
      nodeMeshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
      });
      linkMeshesRef.current.forEach(line => {
        line.geometry.dispose();
        if (Array.isArray(line.material)) line.material.forEach(m => m.dispose());
        else line.material.dispose();
      });
      textSpritesRef.current.forEach(sprite => {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });
      sceneRef.current = null; // Allow garbage collection
      rendererRef.current = null;
    };
  }, [dimensions.width, dimensions.height]);

  // Update nodes and links
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !nodes) return;

    const currentNodeIds = new Set(nodes.map(n => n.id));
    const currentLinkIds = new Set(links.map(l => l.id));

    // Remove old nodes
    nodeMeshesRef.current.forEach((mesh, id) => {
      if (!currentNodeIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else mesh.material.dispose();
        nodeMeshesRef.current.delete(id);
        
        const textSprite = textSpritesRef.current.get(id);
        if (textSprite) {
            scene.remove(textSprite);
            textSprite.material.map?.dispose();
            textSprite.material.dispose();
            textSpritesRef.current.delete(id);
        }
      }
    });

    // Add/Update nodes
    nodes.forEach(node => {
      const { x, y, z } = node.position || { x: 0, y: 0, z: 0 };
      const color = highlightedNodeIds.has(node.id) ? accentColor : (node.color || defaultNodeColor);
      
      let mesh = nodeMeshesRef.current.get(node.id);
      if (mesh) {
        mesh.position.set(x, y, z);
        (mesh.material as THREE.MeshStandardMaterial).color.set(color);
      } else {
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        nodeMeshesRef.current.set(node.id, mesh);
      }

      // Text sprite for node title
      let textSprite = textSpritesRef.current.get(node.id);
      if (textSprite) {
         // Update position, and potentially text if it can change
        textSprite.position.set(x, y + 0.8, z); // Position above the node
      } else {
        const textTextureData = createTextTexture(node.title.length > 20 ? node.title.substring(0, 17) + '...' : node.title);
        if (textTextureData) {
          const { texture, width, height } = textTextureData;
          const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
          textSprite = new THREE.Sprite(spriteMaterial);
          // Scale sprite based on texture aspect ratio and desired visual size
          const aspectRatio = width / height;
          textSprite.scale.set(aspectRatio * 2, 2, 1); // Adjust scale as needed
          textSprite.position.set(x, y + 0.8, z);
          scene.add(textSprite);
          textSpritesRef.current.set(node.id, textSprite);
        }
      }
    });

    // Remove old links
    linkMeshesRef.current.forEach((line, id) => {
      if (!currentLinkIds.has(id)) {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
        linkMeshesRef.current.delete(id);
      }
    });
    
    // Add/Update links
    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      if (!sourceNode || !targetNode || !sourceNode.position || !targetNode.position) return;

      const sourcePos = sourceNode.position;
      const targetPos = targetNode.position;
      const color = highlightedLinkIds.has(link.id) ? accentColor : (link.color || defaultLinkColor);

      let lineMesh = linkMeshesRef.current.get(link.id);
      if (lineMesh) {
        const positions = lineMesh.geometry.attributes.position.array as Float32Array;
        positions[0] = sourcePos.x; positions[1] = sourcePos.y; positions[2] = sourcePos.z;
        positions[3] = targetPos.x; positions[4] = targetPos.y; positions[5] = targetPos.z;
        lineMesh.geometry.attributes.position.needsUpdate = true;
        (lineMesh.material as THREE.LineBasicMaterial).color.set(color);
      } else {
        const points = [
          new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z),
          new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, linewidth: 1 }); // linewidth has limitations
        lineMesh = new THREE.Line(geometry, material);
        scene.add(lineMesh);
        linkMeshesRef.current.set(link.id, lineMesh);
      }
    });

  }, [nodes, links, highlightedNodeIds, highlightedLinkIds, accentColor, defaultNodeColor, defaultLinkColor]);


  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: '500px', borderRadius: '0.5rem', overflow: 'hidden' }} />;
};

export default ThreeDeeCanvas;
