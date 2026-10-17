import catalogJson from "@/data/catalog.json";
import type { CatalogFeed, Category, CountryCode } from "@/types/catalog";
import { CATEGORIES } from "./constants";

export const CATALOG: readonly CatalogFeed[] = catalogJson as CatalogFeed[];

const byId = new Map(CATALOG.map((f) => [f.id, f]));

export function getFeedById(id: string): CatalogFeed | undefined {
  return byId.get(id);
}

export function feedsByCountry(country: CountryCode): CatalogFeed[] {
  return CATALOG.filter((f) => f.country === country);
}

/** 나라·분야 조건에 맞는 피드. 생략한 조건은 필터하지 않는다 */
export function feedsFor(country?: CountryCode, category?: Category): CatalogFeed[] {
  return CATALOG.filter(
    (f) => (country === undefined || f.country === country) && (category === undefined || f.category === category),
  );
}

/** 해당 나라에 피드가 있는 분야 (CATEGORIES 순서) */
export function categoriesForCountry(country: CountryCode): Category[] {
  const available = new Set(feedsByCountry(country).map((f) => f.category));
  return CATEGORIES.map((c) => c.id).filter((id) => available.has(id));
}
