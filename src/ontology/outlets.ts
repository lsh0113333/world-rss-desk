import type { CatalogFeed, CountryCode } from "@/types/catalog";
import { isKnownCountry } from "./countries";

/**
 * 매체 → 본사 나라 ("어느 나라의 시각인가"). 카탈로그의 묶음 지역·국제 구역 매체를 실제 나라로 옮긴다.
 * 여기에 없는 묶음 매체(UN News, AllAfrica)는 나라의 시각이 아니므로 쓰지 않는다.
 */
const REGION_CODES = new Set(["EU", "ME", "ASIA", "LATAM", "AFRICA", "WORLD"]);

const HOME_COUNTRY: Record<string, CountryCode> = {
  euronews: "FR",
  dw: "DE",
  "the guardian": "GB",
  "france 24": "FR",
  "politico europe": "BE",
  euobserver: "BE",
  "balkan insight": "RS",
  sifted: "GB",
  "tech.eu": "BE",
  "eu-startups": "ES",
  "the next web": "NL",
  "al jazeera": "QA",
  "middle east eye": "GB",
  "arab news": "SA",
  "al-monitor": "US",
  cna: "SG",
  "the straits times": "SG",
  mercopress: "UY",
  "bbc news": "GB",
  "the new york times": "US",
  "south china morning post": "CN",
  // IT·과학 전문지 (IT 최우선)
  wired: "US",
  "ars technica": "US",
  "mit technology review": "US",
  "ieee spectrum": "US",
  "hacker news": "US",
  "the hacker news": "IN",
  infoq: "CA",
  "rest of world": "US",
  "phys.org": "GB",
  "science news": "US",
  sciencedaily: "US",
};

/** 피드의 매체 본사 나라. 나라의 시각이 아니면 null */
export function baseCountry(feed: Pick<CatalogFeed, "country" | "name">): CountryCode | null {
  const code = REGION_CODES.has(feed.country) ? HOME_COUNTRY[feed.name.toLowerCase()] : feed.country;
  return code && isKnownCountry(code) ? code : null;
}
