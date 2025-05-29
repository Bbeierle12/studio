
'use client';

import dynamic from "next/dynamic";
import React from "react";

// disable SSR for the entire 3D map component
const KnowledgeMap3D = dynamic(
  () => import("@/components/graph/dynamic-map-renderer"),
  { ssr: false }
);

export default function MapPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "hsl(var(--background))" }}>
      <KnowledgeMap3D />
    </div>
  );
}
