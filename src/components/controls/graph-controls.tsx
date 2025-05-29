
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import FileUploadButton from './file-upload-button';
import { Button } from '@/components/ui/button';
import { Search, Trash2, FileUp } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    if (file.name.endsWith('.json') || file.type === 'application/json') {
      onJsonUpload(file);
    } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
      onPdfUpload(file);
    } else {
      toast({
        title: "Unsupported File Type",
        description: `Please upload a .json or .pdf file. You uploaded: ${file.name}`,
        variant: "destructive",
      });
    }
  };

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
        
        <FileUploadButton
          onFileSelect={handleFileSelect}
          accept=".json,.pdf"
          variant="outline"
          icon={<FileUp className="h-5 w-5" />}
          className="w-full"
        >
          Upload File (.json, .pdf)
        </FileUploadButton>
        
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
