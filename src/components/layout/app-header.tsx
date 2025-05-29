import React from 'react';
import LogoIcon from '@/components/icons/logo-icon';

const AppHeader: React.FC = () => {
  return (
    <header className="p-4 shadow-md bg-card">
      <div className="container mx-auto flex items-center gap-3">
        <LogoIcon className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">
          Knowledge Map<span className="text-primary">3D</span>
        </h1>
      </div>
    </header>
  );
};

export default AppHeader;
