import type { Route } from "./+types/video";
import { VideoPage } from "../pages/VideoPage";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Resize Video" },
    { name: "description", content: "Upload and resize your video files specifying width, height, and FPS." },
  ];
}

export default function Video() {
  return <VideoPage />;
}