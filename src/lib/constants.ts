import type { Continent } from "@/types/catalog";

export interface ContinentMeta {
  id: Continent;
  label: string;
}

export const CONTINENTS: readonly ContinentMeta[] = [
  { id: "asia", label: "아시아" },
  { id: "europe", label: "유럽" },
  { id: "north-america", label: "북미" },
  { id: "south-america", label: "중남미" },
  { id: "middle-east", label: "중동" },
  { id: "africa", label: "아프리카" },
  { id: "oceania", label: "오세아니아" },
  { id: "global", label: "국제" },
];
