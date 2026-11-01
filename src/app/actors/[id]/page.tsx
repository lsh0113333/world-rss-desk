import type { Metadata } from "next";
import { ActorView } from "@/components/ActorView";

export const metadata: Metadata = { title: "행위자 · 오늘의 세계" };

export default async function ActorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActorView id={decodeURIComponent(id)} />;
}
