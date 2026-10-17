import type { Layout } from "@/types/layout";
import { serializeLayout } from "./layout-store";

/** 설정을 JSON 파일로 내려받게 한다 (브라우저 전용) */
export function downloadLayout(layout: Layout) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const url = URL.createObjectURL(new Blob([serializeLayout(layout)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `world-rss-desk-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
