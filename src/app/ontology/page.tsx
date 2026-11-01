import type { Metadata } from "next";
import { OntologyView } from "@/components/OntologyView";

export const metadata: Metadata = { title: "온톨로지 · 오늘의 세계" };

export default function OntologyPage() {
  return <OntologyView />;
}
