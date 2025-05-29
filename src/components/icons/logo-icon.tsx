import type React from 'react';

const LogoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <title>Knowledge Map3D Logo</title>
    {/* Central Node */}
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    {/* Orbiting Nodes */}
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
    <circle cx="5" cy="12" r="1.5" />
    {/* Connections (simplified) */}
    <line x1="12" y1="12" x2="12" y2="5" />
    <line x1="12" y1="12" x2="19" y2="12" />
    <line x1="12" y1="12" x2="12" y2="19" />
    <line x1="12" y1="12" x2="5" y2="12" />
  </svg>
);

export default LogoIcon;
