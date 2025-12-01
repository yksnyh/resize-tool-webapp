import { FFmpeg } from "@ffmpeg/ffmpeg";
// @ts-ignore
import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
import { fetchFile, toBlobURL } from "@ffmpeg/util";

import type { VideoExtensions } from "../commons/fileconst";

// const baseURL = '/assets/libs/3rd-party/ffmpeg/0.12.9-mt';
const baseURL = import.meta.env.BASE_URL + 'assets/libs/3rd-party/ffmpeg/0.12.10';
// const baseURL = 'https://app.unpkg.com/@ffmpeg/core-mt@0.12.9/files/dist/esm/';
const ffmpeg = new FFmpeg();

export const getVideoSize = async (videoData: Blob): Promise<{ width: number, height: number }> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoData);
    video.addEventListener('progress', () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    });
  });
}

export const resizeVideo = async (
  videoData: Blob,
  width: number | null,
  height: number | null,
  fps: number | null,
  ext: VideoExtensions,
  onProgress: (message: string, percent?: number) => void, 
): Promise<Blob | null> => {
  if (!width && !height && !fps) return videoData;

  const { width: beforeWidth, height: beforeHeight } = await getVideoSize(videoData);
  onProgress(`${beforeWidth}: ${beforeHeight}`);

  if (!fps) {
    if (beforeWidth === width && (beforeHeight === height || !height)) return videoData;
    if (beforeHeight === height && (beforeWidth === width || !width)) return videoData;
  }

  let afterWidth = width ? width : Math.floor((height || 0) * beforeWidth / beforeHeight);
  if (afterWidth % 2 !== 0) afterWidth += 1;
  let afterHeight = height ? height : Math.floor((width || 0) * (beforeHeight / beforeWidth));
  if (afterHeight % 2 !== 0) afterHeight += 1;

  try {
    ffmpeg.on('log', ({ message: msg }: LogEvent) => {
      onProgress(msg);
    });

    if (!ffmpeg.loaded) {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        // workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
      });
    }

    const inputFilename = 'tmp.' + ext;
    const outputFilename = 'tmp_output.mp4';
    let vfOpt = `scale=${afterWidth}:${afterHeight}`;
    if (afterWidth % 2 !== 0 || afterHeight % 2 !== 0) vfOpt = `${vfOpt},format=yuv444p`;
    if (fps) vfOpt = `${vfOpt},fps=${fps}`;
    // ffmpeg.FS('writeFile', name, await fetchFile(files[0]));
    await ffmpeg.writeFile(inputFilename, await fetchFile(videoData));
    const ret = await ffmpeg.exec(['-i', inputFilename, '-vf', vfOpt, outputFilename]);
    const data = await ffmpeg.readFile(outputFilename);
    await ffmpeg.deleteFile(outputFilename);
    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' })
  } catch (err) {
    console.error(err);
    return null;
  }
}