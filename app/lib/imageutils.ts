import type { ImageExtensions } from "../commons/fileconst";

export const getImageSize = async (imageData: Blob): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(imageData);
  });
};

export const resizeImage = async (
  imageData: Blob,
  width: number | null,
  height: number | null,
  ext: ImageExtensions,
  onProgress: (message: string, percent?: number) => void,
): Promise<Blob | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!width && !height) {
        resolve(imageData);
        return;
      }

      onProgress("Loading image...", 10);
      const img = new Image();
      const loadPromise = new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = (e) => rej(e);
      });
      img.src = URL.createObjectURL(imageData);
      await loadPromise;

      const beforeWidth = img.width;
      const beforeHeight = img.height;
      onProgress(`Original size: ${beforeWidth}x${beforeHeight}`, 30);

      let afterWidth = width ? width : Math.floor((height || 0) * beforeWidth / beforeHeight);
      let afterHeight = height ? height : Math.floor((width || 0) * beforeHeight / beforeWidth);

      // Keep original size if no resize needed
      if ((!width && !height) || (width === beforeWidth && height === beforeHeight)) {
         resolve(imageData);
         URL.revokeObjectURL(img.src);
         return;
      }
      
      onProgress(`Target size: ${afterWidth}x${afterHeight}`, 50);

      const canvas = document.createElement('canvas');
      canvas.width = afterWidth;
      canvas.height = afterHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Better quality resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(img, 0, 0, afterWidth, afterHeight);
      onProgress("Drawing to canvas...", 70);

      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      if (ext === 'gif') mimeType = 'image/gif';
      if (ext === 'avif') mimeType = 'image/avif';
      // For jpg/jpeg, we can default to 0.9 quality, or make it configurable if needed.
      // For now, let's stick to default.
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        if (blob) {
            onProgress("Conversion complete.", 100);
            resolve(blob);
        } else {
            reject(new Error("Canvas toBlob failed"));
        }
      }, mimeType);

    } catch (error) {
      reject(error);
    }
  });
};
