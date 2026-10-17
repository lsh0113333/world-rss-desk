import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World RSS Desk",
  description: "대륙·나라·분야별 RSS 헤드라인을 한 화면에서",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
