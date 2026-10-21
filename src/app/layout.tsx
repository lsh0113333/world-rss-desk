import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World RSS Desk",
  description: "대륙 → 나라 → 매체별 세계 뉴스 헤드라인을 한 페이지에서",
  appleWebApp: { capable: true, title: "RSS Desk", statusBarStyle: "black-translucent" },
};

// 기본은 어두운 테마 (밝게 바꾸면 Dashboard가 theme-color를 바꾼다). 노치·홈 바 영역까지 그린다
export const viewport: Viewport = {
  themeColor: "#0a0e17",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-theme="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router 루트 레이아웃이라 모든 페이지에 적용된다 (이 규칙은 pages/_document용) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=JetBrains+Mono:wght@500;700&display=swap" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
