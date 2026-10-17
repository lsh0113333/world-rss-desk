import { ImageResponse } from "next/og";

/** 앱 아이콘: 파란 바탕에 신문 헤드라인 줄 (UI_GUIDE v2 강조색) */
export function renderAppIcon(size: number): ImageResponse {
  const pad = size * 0.2;
  const line = (width: number, color: string, height = size * 0.07) => (
    <div style={{ width: width * (size - pad * 2), height, background: color, borderRadius: height / 2 }} />
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: size * 0.08,
          padding: pad,
          background: "#2563eb",
        }}
      >
        {line(0.45, "#ffffff", size * 0.1)}
        {line(1, "#dbeafe")}
        {line(0.8, "#93c5fd")}
        {line(0.9, "#93c5fd")}
      </div>
    ),
    { width: size, height: size },
  );
}
