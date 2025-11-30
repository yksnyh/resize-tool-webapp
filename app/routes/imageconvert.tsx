import type { Route } from "./+types/imageconvert";
import { ImageConvertPage } from "../pages/ImageConvertPage";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Convert Image" },
    { name: "description", content: "Upload and resize your image files specifying width and height." },
  ];
}

export default function ImageConvert() {
  return <ImageConvertPage />;
}