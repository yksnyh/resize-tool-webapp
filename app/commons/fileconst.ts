export const fileExtensions = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'avif'] as const,
  video: ['mp4', 'mov', 'webm'] as const,
  text: ['txt', 'log', 'md', 'html'] as const,
};
export type FileTypes = keyof typeof fileExtensions;
export type ImageExtensions = (typeof fileExtensions.image)[number];
export type VideoExtensions = (typeof fileExtensions.video)[number];