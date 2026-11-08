import type { Metadata } from "next";
import { RelationsView } from "@/components/RelationsView";

export const metadata: Metadata = { title: "관계 · 오늘의 세계" };

export default function RelationsPage() {
  return <RelationsView />;
}
