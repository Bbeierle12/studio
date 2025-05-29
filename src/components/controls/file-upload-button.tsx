'use client';

import React, { useRef, type ChangeEvent, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface FileUploadButtonProps extends Omit<ButtonProps, 'onClick' | 'type'> {
  onFileSelect: (file: File) => void;
  accept?: string;
  children: ReactNode;
  icon?: ReactNode;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onFileSelect,
  accept,
  children,
  icon,
  variant = 'default',
  size = 'default',
  className,
  ...props
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset file input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        aria-hidden="true"
      />
      <Button
        onClick={handleButtonClick}
        variant={variant}
        size={size}
        className={className}
        {...props}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </Button>
    </>
  );
};

export default FileUploadButton;
