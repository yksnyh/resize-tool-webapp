import React, { useState, useEffect } from 'react';
import { getImageSize } from '../lib/imageutils';
import { ImageMagick, initializeImageMagick, MagickFormat } from '@imagemagick/magick-wasm';
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Download, Trash2, Image as ImageIcon, AlertCircle } from "lucide-react";

interface ImageResult {
  displayUrl: string; // URL for <img> src (converted if necessary)
  downloadUrl: string; // URL for download (original)
  originalBlob: Blob; // The original blob
  width: number;
  height: number;
  format: string; // Original format
  size: number; // Original size
}

export function Base64ImagePage() {
  const [inputString, setInputString] = useState('');
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMagickInitialized, setIsMagickInitialized] = useState(false);

  useEffect(() => {
    const initMagick = async () => {
      try {
        await initializeImageMagick(new URL(import.meta.env.BASE_URL + 'assets/libs/3rd-party/imagemagick/magick.wasm', window.location.origin));
        setIsMagickInitialized(true);
      } catch (e) {
        console.error("Failed to initialize ImageMagick", e);
        // We don't block the page, but JP2 conversion might fail
      }
    };
    initMagick();

    return () => {
      if (result) {
        URL.revokeObjectURL(result.displayUrl);
        if (result.displayUrl !== result.downloadUrl) {
           URL.revokeObjectURL(result.downloadUrl);
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConvert = async () => {
    if (!inputString.trim()) {
      setError("Please enter a Base64 string.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let base64 = inputString.trim();
      let mimeType = '';

      // Check for Data URI scheme
      const dataUriPattern = /^data:([^;]+);base64,(.*)$/s;
      const match = base64.match(dataUriPattern);
      
      if (match) {
        mimeType = match[1];
        base64 = match[2];
      } else {
        if (base64.startsWith('data:') && base64.includes('base64,')) {
             const parts = base64.split('base64,');
             if (parts.length > 1) {
                 const prefix = parts[0];
                 const mimeMatch = prefix.match(/data:(.*?);/);
                 if (mimeMatch) mimeType = mimeMatch[1];
                 base64 = parts.slice(1).join('base64,');
             }
        }
      }

      base64 = base64.replace(/\s/g, '');
      base64 = base64.replace(/-/g, '+').replace(/_/g, '/');

      const pad = base64.length % 4;
      if (pad) {
        if (pad === 1) {
          throw new Error("Invalid Base64 length");
        }
        base64 += new Array(5 - pad).join('=');
      }

      let binStr;
      try {
        binStr = atob(base64);
      } catch (e) {
        throw new Error("Invalid Base64 characters.");
      }
      
      const len = binStr.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        arr[i] = binStr.charCodeAt(i);
      }

      // Detect MIME type if not provided
      const headerHex = Array.from(arr.slice(0, 12)).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
      
      if (!mimeType) {
        if (headerHex.startsWith('FFD8FF')) mimeType = 'image/jpeg';
        else if (headerHex.startsWith('89504E47')) mimeType = 'image/png';
        else if (headerHex.startsWith('47494638')) mimeType = 'image/gif';
        else if (headerHex.startsWith('52494646')) mimeType = 'image/webp';
        else if (headerHex.startsWith('424D')) mimeType = 'image/bmp';
        else if (headerHex.startsWith('0000000C6A502020')) mimeType = 'image/jp2'; // JP2 signature
        else mimeType = 'application/octet-stream';
      }

      let width = 0;
      let height = 0;
      let displayUrl = '';
      let downloadUrl = '';
      let originalBlob = new Blob([arr], { type: mimeType });

      if ((mimeType === 'image/jp2' || headerHex.startsWith('0000000C6A502020'))) {
          // Special handling for JP2
          if (!isMagickInitialized) {
              throw new Error("ImageMagick is not initialized. Cannot process JP2.");
          }
          mimeType = 'image/jp2'; // Ensure mime type is correct if detected by signature
          originalBlob = new Blob([arr], { type: mimeType });

          await new Promise<void>((resolve, reject) => {
              try {
                  ImageMagick.read(arr, (image) => {
                      width = image.width;
                      height = image.height;
                      image.write(MagickFormat.Jpeg, (data) => {
                          const safeData = new Uint8Array(data);
                          const jpegBlob = new Blob([safeData], { type: 'image/jpeg' });
                          displayUrl = URL.createObjectURL(jpegBlob);
                          resolve();
                      });
                  });
              } catch (e) {
                  reject(e);
              }
          });
          downloadUrl = URL.createObjectURL(originalBlob);
      } else {
          // Standard Image Handling
          downloadUrl = URL.createObjectURL(originalBlob);
          displayUrl = downloadUrl; // Same for display
          
          try {
            const size = await getImageSize(originalBlob);
            width = size.width;
            height = size.height;
          } catch (e) {
            console.warn("Could not determine image size (maybe not an image or corrupt)", e);
          }
      }

      setResult({
        displayUrl,
        downloadUrl,
        originalBlob,
        width,
        height,
        format: mimeType,
        size: originalBlob.size
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to decode Base64 string.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputString('');
    if (result) {
        URL.revokeObjectURL(result.displayUrl);
        if (result.displayUrl !== result.downloadUrl) {
           URL.revokeObjectURL(result.downloadUrl);
        }
    }
    setResult(null);
    setError(null);
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.downloadUrl;
    
    // Guess extension
    let ext = 'bin';
    if (result.format.includes('jpeg') || result.format.includes('jpg')) ext = 'jpg';
    else if (result.format.includes('png')) ext = 'png';
    else if (result.format.includes('gif')) ext = 'gif';
    else if (result.format.includes('webp')) ext = 'webp';
    else if (result.format.includes('svg')) ext = 'svg';
    else if (result.format.includes('bmp')) ext = 'bmp';
    else if (result.format.includes('jp2')) ext = 'jp2';

    link.download = `decoded-image.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <Card className="max-w-4xl mx-auto my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6" />
          Base64 to Image Converter
        </CardTitle>
        <CardDescription>
          Paste a Base64 string (standard or URL-safe) to decode and view the image. Supports typical web images and JP2 (converted to JPEG for display).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="base64-input">Base64 String</Label>
          <Textarea
            id="base64-input"
            placeholder="Paste your Base64 string here..."
            className="font-mono text-xs min-h-[150px]"
            value={inputString}
            onChange={(e) => setInputString(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConvert} disabled={loading || !inputString}>
            {loading ? 'Decoding...' : 'Decode Image'}
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={loading}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="mt-6 border rounded-lg p-4 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center bg-background border rounded-md p-4 min-h-[200px]">
                <img 
                  src={result.displayUrl} 
                  alt="Decoded" 
                  className="max-w-full max-h-[400px] object-contain" 
                />
                {result.format === 'image/jp2' && (
                    <p className="text-xs text-muted-foreground mt-2">(JP2 preview converted to JPEG)</p>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Image Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-semibold">Format:</div>
                    <div>{result.format}</div>
                    
                    <div className="font-semibold">Dimensions:</div>
                    <div>{result.width} x {result.height} px</div>
                    
                    <div className="font-semibold">Size:</div>
                    <div>{formatBytes(result.size)}</div>
                  </div>
                </div>
                
                <Button onClick={handleDownload} className="w-full md:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Download Image
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}