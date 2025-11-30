import type { Route } from "./+types/home";
import { HomePage } from "../pages/HomePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Convert tools" },
    { name: "description", content: "Convert tools!" },
  ];
}

export default function Home() {
  return <HomePage />;
}