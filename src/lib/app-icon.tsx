import { ImageResponse } from "next/og";

/** 앱 아이콘: 어두운 바탕에 신문 헤드라인 줄 + 앰버 포인트 (UI_GUIDE 색상) */
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
          background: "#0c0c0c",
        }}
      >
        {line(0.45, "#f59e0b", size * 0.1)}
        {line(1, "#f5f5f5")}
        {line(0.8, "#8a8a8a")}
        {line(0.9, "#8a8a8a")}
      </div>
    ),
    { width: size, height: size },
  );
}
