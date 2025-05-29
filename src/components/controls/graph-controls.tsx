
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import FileUploadButton from './file-upload-button';
import { Button } from '@/components/ui/button';
import { Search, FileJson, FileText, Trash2, UploadCloud } from 'lucide-react';

interface GraphControlsProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onJsonUpload: (file: File) => void;
  onPdfUpload: (file: File) => void;
  onClearMap: () => void;
}

const GraphControls: React.FC<GraphControlsProps> = ({
  searchTerm,
  onSearchTermChange,
  onJsonUpload,
  onPdfUpload,
  onClearMap,
}) => {
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-center">Graph Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-10"
            aria-label="Search nodes"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileUploadButton
            onFileSelect={onJsonUpload}
            accept=".json"
            variant="outline"
            icon={<FileJson className="h-5 w-5" />}
          >
            Upload JSON
          </FileUploadButton>
          <FileUploadButton
            onFileSelect={onPdfUpload}
            accept=".pdf"
            variant="outline"
            icon={<FileText className="h-5 w-5" />}
          >
            Upload PDF
          </FileUploadButton>
          <FileUploadButton
            onFileSelect={onPdfUpload} // Reusing PDF upload logic for now
            accept=".pdf" // Assuming PDFs from Drive for now
            variant="outline"
            icon={<UploadCloud className="h-5 w-5" />}
            className="sm:col-span-2" // Make it full width on sm screens if it's the third item
          >
            Upload from Drive
          </FileUploadButton>
        </div>
        
        <Button
          onClick={onClearMap}
          variant="destructive"
          className="w-full"
          aria-label="Clear map"
        >
          <Trash2 className="mr-2 h-5 w-5" />
          Clear Map
        </Button>
      </CardContent>
    </Card>
  );
};

export default GraphControls;
