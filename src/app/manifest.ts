import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "World RSS Desk",
    short_name: "RSS Desk",
    description: "대륙·나라·분야별 RSS 헤드라인을 한 화면에서",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
