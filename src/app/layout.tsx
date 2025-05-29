import './globals.css';

export const metadata = {
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
