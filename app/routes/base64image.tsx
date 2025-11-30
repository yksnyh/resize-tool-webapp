import type { Route } from './+types/base64image';
import { Base64ImagePage } from '../pages/Base64ImagePage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Convert tools" },
    { name: "description", content: "Convert tools!" },
  ];
}

export default function Home() {
  return <Base64ImagePage />;
}