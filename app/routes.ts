import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("image", "routes/image.tsx"),
  route("video", "routes/video.tsx"),
] satisfies RouteConfig;
