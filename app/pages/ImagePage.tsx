import React, { useState, useEffect, useRef, useCallback } from 'react';
import { resizeImage, getImageSize } from '../lib/imageutils';
import { fileExtensions, type ImageExtensions } from "../commons/fileconst";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FormItem } from "~/components/ui/form";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { XCircle } from "lucide-react";

const MAX_FILES = 5; // Allow more files for images

// Interface for processing results
interface ProcessingResult {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  originalWidth?: number;
  originalHeight?: number;
  outputBlob?: Blob;
  outputUrl?: string;
  progressLog: string[];
  error?: string;
  progressPercent?: number;
}

export function ImagePage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressEndRefs = useRef<(HTMLDivElement | null)[]>([]);

  const latestResultsRef = useRef(results);

  useEffect(() => {
    latestResultsRef.current = results;
  }, [results]);

  useEffect(() => {
    return () => {
      latestResultsRef.current.forEach(r => {
        if (r.outputUrl) {
          URL.revokeObjectURL(r.outputUrl);
        }
      });
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles: File[] = [];
      const fileErrors: string[] = [];
      let acceptedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (acceptedCount >= MAX_FILES) {
          fileErrors.push(`You can only select up to ${MAX_FILES} files. File "${file.name}" was ignored.`);
          continue;
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (fileExt && fileExtensions.image.includes(fileExt as ImageExtensions)) {
          newFiles.push(file);
          acceptedCount++;
        } else {
          fileErrors.push(`Unsupported file type: "${file.name}". Supported types: ${fileExtensions.image.join(', ')}`);
        }
      }

      setSelectedFiles(newFiles);
      setResults([]);
      setError(fileErrors.length > 0 ? fileErrors.join('\n') : null);

      Promise.all(newFiles.map(async (file) => {
        try {
            const { width: originalWidth, height: originalHeight } = await getImageSize(file);
            return {
            file,
            status: 'pending' as const,
            progressLog: [] as string[],
            progressPercent: 0,
            originalWidth,
            originalHeight,
            };
        } catch (e) {
             return {
                file,
                status: 'error' as const,
                progressLog: ['Failed to load image size'],
                progressPercent: 0,
                error: 'Invalid image file'
            };
        }
      })).then(initialResults => {
        setResults(initialResults);
        progressEndRefs.current = initialResults.map(() => null);
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateProgress = useCallback((fileIndex: number, message: string, percent?: number) => {
    setResults(prevResults => {
      const newResults = [...prevResults];
      if (newResults[fileIndex]) {
        newResults[fileIndex] = {
          ...newResults[fileIndex],
          progressLog: [...newResults[fileIndex].progressLog, message],
          progressPercent: percent !== undefined ? percent : newResults[fileIndex].progressPercent,
        };
      }
      return newResults;
    });
  }, []);

  const handleResizeClick = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one image file.');
      return;
    }

    const targetWidth = width === '' ? null : Number(width);
    const targetHeight = height === '' ? null : Number(height);

    if (targetWidth === null && targetHeight === null) {
      setError('Please specify at least one parameter: width or height.');
      return;
    }

    if (targetWidth !== null && targetHeight !== null) {
      setError('Please specify either width or height, not both.');
      return;
    }

    if ((targetWidth !== null && targetWidth <= 0) || (targetHeight !== null && targetHeight <= 0)) {
      setError('Width and height must be positive numbers.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const initialResults: ProcessingResult[] = results.map(r => ({
      ...r,
      status: r.status === 'error' ? 'error' : 'pending', // Keep existing errors
      progressLog: [],
      progressPercent: 0,
    }));
    setResults(initialResults);
    progressEndRefs.current = initialResults.map(() => null);

    for (let i = 0; i < selectedFiles.length; i++) {
      if (initialResults[i].status === 'error') continue;

      const file = selectedFiles[i];
      const fileExt = file.name.split('.').pop()?.toLowerCase() as ImageExtensions;

      setResults(prev => {
        const newResults = [...prev];
        newResults[i] = { ...newResults[i], status: 'processing', progressLog: ['Starting process...'] };
        return newResults;
      });

      try {
        const resultBlob = await resizeImage(
          file,
          targetWidth,
          targetHeight,
          fileExt,
          (message, percent) => updateProgress(i, message, percent)
        );

        if (resultBlob) {
          const url = URL.createObjectURL(resultBlob);
          setResults(prev => {
            const newResults = [...prev];
            newResults[i] = {
              ...newResults[i],
              status: 'success',
              outputBlob: resultBlob,
              outputUrl: url,
              progressLog: [...newResults[i].progressLog, 'Processing complete! Output image is ready.'],
              progressPercent: 100,
            };
            return newResults;
          });
        } else {
          setResults(prev => {
            const newResults = [...prev];
            const errorMessage = 'Image processing failed.';
            newResults[i] = {
              ...newResults[i],
              status: 'error',
              error: errorMessage,
              progressLog: [...newResults[i].progressLog, `Error: ${errorMessage}`],
            };
            return newResults;
          });
        }
      } catch (err: any) {
        console.error(`Error processing file ${file.name}:`, err);
        const errorMessage = `An unexpected error occurred: ${err.message || err}`;
        setResults(prev => {
          const newResults = [...prev];
          newResults[i] = {
            ...newResults[i],
            status: 'error',
            error: errorMessage,
            progressLog: [...newResults[i].progressLog, `Error: ${errorMessage}`],
          };
          return newResults;
        });
      }
    }

    setIsProcessing(false);
  };

  const handleDownload = (url: string | undefined, blob: Blob | undefined, originalFileName: string) => {
    if (url && blob) {
      const link = document.createElement('a');
      link.href = url;
      const fileExt = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
      const baseName = originalFileName.split('.').slice(0, -1).join('.') || 'image';
      link.download = `${baseName}_resized.${fileExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClear = () => {
    results.forEach(r => {
      if (r.outputUrl) {
        URL.revokeObjectURL(r.outputUrl);
      }
    });
    setSelectedFiles([]);
    setWidth('');
    setHeight('');
    setResults([]);
    setIsProcessing(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const acceptTypes = fileExtensions.image.map(ext => `image/${ext},.${ext}`).join(',');

  return (
    <Card className="max-w-4xl mx-auto my-4">
      <CardHeader>
        <CardTitle>Resize Multiple Images</CardTitle>
        <CardDescription>
          Select up to {MAX_FILES} image files, specify desired dimensions (width/height), then click "Resize Images".
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6">
        <FormItem>
          <Label htmlFor="imageFiles">Select Image Files (Max {MAX_FILES})</Label>
          <Input
            ref={fileInputRef}
            type="file"
            id="imageFiles"
            accept={acceptTypes}
            onChange={handleFileChange}
            disabled={isProcessing}
            multiple
            className="w-full"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium">Selected Files:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {results.map((result, index) => (
                  <li key={index}>
                    {result.file.name}
                    ({(result.file.size / 1024 / 1024).toFixed(2)} MB)
                    {result.originalWidth && result.originalHeight &&
                      <span className="ml-2">({result.originalWidth}x{result.originalHeight})</span>
                    }
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FormItem>

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormItem>
              <Label htmlFor="width">Width (px)</Label>
              <Input
                type="number"
                id="width"
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  if (e.target.value !== '') {
                    setHeight('');
                  }
                }}
                placeholder="Auto"
                min="1"
                disabled={isProcessing}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for auto</p>
            </FormItem>

            <FormItem>
              <Label htmlFor="height">Height (px)</Label>
              <Input
                type="number"
                id="height"
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  if (e.target.value !== '') {
                    setWidth('');
                  }
                }}
                placeholder="Auto"
                min="1"
                disabled={isProcessing}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for auto</p>
            </FormItem>
          </div>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Note: Please specify either Width or Height, not both.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleResizeClick}
            disabled={isProcessing || selectedFiles.length === 0}
            className="flex-grow sm:flex-grow-0"
          >
            {isProcessing ? 'Processing...' : `Resize ${selectedFiles.length > 0 ? selectedFiles.length : ''} Image(s)`}
          </Button>
          <Button
            onClick={handleClear}
            disabled={isProcessing}
            variant="outline"
            className="flex-grow sm:flex-grow-0"
          >
            Clear All
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold border-b pb-2">Processing Results:</h3>
            {results.map((result, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-muted/50 p-4">
                  <CardTitle className="text-base">
                    File: {result.file.name}
                    {result.status === 'processing' && <span className="ml-2 text-sm font-normal text-primary animate-pulse"> (Processing...)</span>}
                    {result.status === 'success' && <span className="ml-2 text-sm font-normal text-green-600"> (Completed)</span>}
                    {result.status === 'error' && <span className="ml-2 text-sm font-normal text-destructive"> (Failed)</span>}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Original size: {(result.file.size / 1024 / 1024).toFixed(2)} MB
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid gap-4">
                  {(result.status === 'processing' || result.status === 'success') && result.progressPercent !== undefined && (
                    <Progress value={result.progressPercent} className="w-full h-2" />
                  )}

                  {(result.status !== 'pending' && result.progressLog.length > 0) && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Progress Log:</Label>
                      <pre className="max-h-40 overflow-y-auto rounded-md border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {result.progressLog.join('\n')}
                        <div ref={el => { progressEndRefs.current[index] = el }} />
                      </pre>
                    </div>
                  )}

                  {result.status === 'error' && result.error && (
                    <Alert variant="destructive" className="mt-2">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Processing Error</AlertTitle>
                      <AlertDescription className="text-xs">
                        {result.error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {result.status === 'success' && result.outputUrl && (
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold">Result:</Label>
                      <img
                        src={result.outputUrl}
                        alt="Resized Result"
                        className="w-full max-w-sm rounded-md border bg-muted mx-auto"
                        style={{ maxHeight: '300px', objectFit: 'contain' }}
                      />
                      <div className="flex items-center gap-4 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleDownload(result.outputUrl, result.outputBlob, result.file.name)}
                        >
                          Download Resized Image
                        </Button>
                        {result.outputBlob && (
                          <span className="text-sm text-muted-foreground">
                            Output size: {(result.outputBlob.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}