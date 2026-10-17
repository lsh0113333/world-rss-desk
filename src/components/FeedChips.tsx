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
    <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap px-4 pb-2 [scrollbar-width:none]">
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
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs transition-colors ${
              on
                ? "border-accent/30 bg-accent-soft text-accent"
                : "border-line text-muted hover:text-body disabled:text-faint disabled:hover:text-faint"
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
          className="shrink-0 rounded-full border border-dashed border-accent/40 px-2 py-0.5 text-xs text-accent"
        >
          {hostOf(url)}
        </span>
      ))}
    </div>
  );
}
