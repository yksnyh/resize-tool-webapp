import type { Route } from "./+types/image";
import { ImagePage } from "../pages/ImagePage";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Resize Image" },
    { name: "description", content: "Upload and resize your image files specifying width and height." },
  ];
}

export default function Image() {
  return <ImagePage />;
}