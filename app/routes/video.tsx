import type { Route } from "./+types/about";
import { VideoPage } from "../pages/VideoPage";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Resize Video" },
    { name: "description", content: "Upload and resize your video files specifying width, height, and FPS." },
  ];
}

export default function AboutPage() {
  return <VideoPage />;
}