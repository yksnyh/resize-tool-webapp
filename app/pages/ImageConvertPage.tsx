import React, { useState, useEffect, useRef } from 'react';
import { ImageMagick, initializeImageMagick, MagickFormat } from '@imagemagick/magick-wasm';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { XCircle } from "lucide-react";

export function ImageConvertPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>('png');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [isMagickInitialized, setIsMagickInitialized] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initMagick = async () => {
      try {
        await initializeImageMagick(new URL('/assets/libs/3rd-party/imagemagick/magick.wasm', window.location.origin));
        setIsMagickInitialized(true);
      } catch (e) {
        console.error("Failed to initialize ImageMagick", e);
        setError("Failed to initialize ImageMagick library. Please refresh the page.");
      }
    };
    initMagick();

    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Basic validation
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      // We'll allow any image type that ImageMagick likely supports, 
      // but warn if it's not in our standard list? 
      // For now, let's accept what the input accepts.
      
      setSelectedFile(file);
      setError(null);
      // Reset output
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
      setOutputBlob(null);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile || !isMagickInitialized) return;

    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      ImageMagick.read(uint8Array, (image) => {
        let format: MagickFormat = MagickFormat.Png;
        switch (targetFormat) {
            case 'jpg':
            case 'jpeg':
                format = MagickFormat.Jpeg;
                break;
            case 'png':
                format = MagickFormat.Png;
                break;
            case 'gif':
                format = MagickFormat.Gif;
                break;
            case 'avif':
                format = MagickFormat.Avif;
                break;
            case 'webp':
                format = MagickFormat.WebP;
                break;
            case 'bmp':
                format = MagickFormat.Bmp;
                break;
            case 'jp2':
                format = MagickFormat.Jp2;
                break;
             // Default to PNG if unknown
            default:
                format = MagickFormat.Png;
        }

        image.write(format, (data) => {
            const safeData = new Uint8Array(data);
            const blob = new Blob([safeData], { type: `image/${targetFormat === 'jpg' ? 'jpeg' : targetFormat}` });
            const url = URL.createObjectURL(blob);
            setOutputBlob(blob);
            setOutputUrl(url);
        });
      });
    } catch (err: any) {
        console.error(err);
        setError(`Conversion failed: ${err.message || "Unknown error"}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (outputUrl && selectedFile) {
        const link = document.createElement('a');
        link.href = outputUrl;
        const originalName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
        link.download = `${originalName}_converted.${targetFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleClear = () => {
      setSelectedFile(null);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
      setOutputBlob(null);
      setError(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  // Construct accept types string
  // Using generic image/* allows more flexibility for input, 
  // but we can stick to fileExtensions if we want to be strict.
  // The user asked to limit upload to 1 file.
  const acceptTypes = "image/*,.jp2,image/jp2"; 

  const targetFormats = ['jpg', 'png', 'gif', 'avif', 'webp', 'bmp', 'jp2'];

  return (
    <Card className="max-w-4xl mx-auto my-4">
      <CardHeader>
        <CardTitle>Convert Image Format</CardTitle>
        <CardDescription>
          Upload an image file and convert it to a different format.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6">
        {/* File Input */}
        <div className="grid gap-2">
            <Label htmlFor="imageFile">Select Image File</Label>
            <Input
                ref={fileInputRef}
                type="file"
                id="imageFile"
                accept={acceptTypes}
                onChange={handleFileChange}
                disabled={isProcessing}
                className="w-full"
            />
            {selectedFile && (
                <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
            )}
        </div>

        {/* Format Selection */}
        <div className="grid gap-2">
            <Label htmlFor="formatSelect">Target Format</Label>
            <Select 
                value={targetFormat} 
                onValueChange={setTargetFormat}
                disabled={isProcessing}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                    {targetFormats.map(fmt => (
                        <SelectItem key={fmt} value={fmt}>{fmt.toUpperCase()}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
            <Button 
                onClick={handleConvert} 
                disabled={!selectedFile || isProcessing || !isMagickInitialized}
            >
                {isProcessing ? 'Converting...' : 'Convert Image'}
            </Button>
            <Button 
                onClick={handleClear} 
                variant="outline"
                disabled={isProcessing}
            >
                Clear
            </Button>
        </div>

        {/* Error Display */}
        {error && (
            <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {/* Result Display */}
        {outputUrl && (
            <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Result</h3>
                <div className="flex flex-col items-center gap-4">
                    <img 
                        src={outputUrl} 
                        alt="Converted Result" 
                        className="max-h-[400px] max-w-full object-contain border rounded-md bg-muted"
                    />
                    <div className="flex items-center gap-4">
                        <Button onClick={handleDownload}>
                            Download Converted Image
                        </Button>
                         {outputBlob && (
                          <span className="text-sm text-muted-foreground">
                            Size: {(outputBlob.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                    </div>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}