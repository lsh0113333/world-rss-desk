import type { CatalogFeed } from "@/types/catalog";

interface Props {
  options: CatalogFeed[];
  selected: string[];
  customUrls: string[];
  max: number;
  onToggle(id: string): void;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** 패널 안에서 매체를 바로 켜고 끄는 칩 줄 (한 줄 가로 스크롤) */
export function FeedChips({ options, selected, customUrls, max, onToggle }: Props) {
  if (options.length === 0 && customUrls.length === 0) return null;
  const full = selected.length + customUrls.length >= max;

  return (
    <div className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-line px-3 py-1.5 [scrollbar-width:none]">
      {options.map((feed) => {
        const on = selected.includes(feed.id);
        return (
          <button
            key={feed.id}
            type="button"
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onToggle(feed.id)}
            title={feed.note ? `${feed.name} · ${feed.note}` : feed.name}
            className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${
              on ? "border-headline text-headline" : "border-line text-faint hover:text-muted disabled:hover:text-faint"
            }`}
          >
            {feed.name}
          </button>
        );
      })}
      {customUrls.map((url) => (
        <span
          key={url}
          title={`직접 추가한 RSS: ${url} (편집 창에서 관리)`}
          className="shrink-0 rounded border border-dashed border-headline px-1.5 py-0.5 text-xs text-headline"
        >
          {hostOf(url)}
        </span>
      ))}
    </div>
  );
}
