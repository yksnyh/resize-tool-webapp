import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("video", "routes/video.tsx"),
  route("image", "routes/image.tsx"),
  route("imageconvert", "routes/imageconvert.tsx"),
  route("base64image", "routes/base64image.tsx"),
] satisfies RouteConfig;
