
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
  description: 'A revolutionary 3D knowledge map',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head />
      <body>{children}</body>
    </html>
  );
}
