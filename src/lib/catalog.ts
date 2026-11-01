import catalogJson from "@/data/catalog.json";
import type { CatalogFeed } from "@/types/catalog";

export const CATALOG: readonly CatalogFeed[] = catalogJson as CatalogFeed[];
