import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "오늘의 세계",
    short_name: "오늘의 세계",
    description: "한눈에 보는 오늘의 세계 흐름",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e17",
    theme_color: "#0a0e17",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
