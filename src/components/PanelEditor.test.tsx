import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { feedsFor } from "@/lib/catalog";
import type { Panel } from "@/types/layout";
import type { DiscoverResult } from "@/services/discover";
import { PanelEditor, type PanelEditorProps } from "./PanelEditor";

function setup(props: Partial<PanelEditorProps> = {}) {
  const handlers = {
    onSave: vi.fn(),
    onClose: vi.fn(),
    onDelete: vi.fn(),
    discover: vi.fn(async (): Promise<DiscoverResult> => ({ feeds: [{ url: "https://example.com/rss", title: "Example Feed", articleCount: 20 }] })),
  };
  render(<PanelEditor {...handlers} {...props} />);
  return handlers;
}

const feedList = () => within(screen.getByRole("group", { name: "매체" }));

describe("PanelEditor — add", () => {
  it("defaults to 한국 · 종합 with all matching feeds checked", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "패널 추가" })).toBeInTheDocument();
    expect(screen.getByLabelText("나라")).toHaveValue("KR");
    expect(screen.getByRole("radio", { name: "종합" })).toBeChecked();
    for (const feed of feedsFor("KR", "top")) {
      expect(feedList().getByRole("checkbox", { name: new RegExp(feed.name) })).toBeChecked();
    }
  });

  it("switching country and category reselects the catalog feeds", async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText("대륙"), "north-america");
    expect(screen.getByLabelText("나라")).toHaveValue("US");
    await userEvent.click(screen.getByRole("radio", { name: "IT" }));
    const names = feedList()
      .getAllByRole("checkbox")
      .map((c) => c.closest("label")?.textContent);
    expect(names).toHaveLength(feedsFor("US", "tech").length);
    expect(names.join()).toContain("TechCrunch");
  });

  it("only offers categories the country has", async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText("대륙"), "south-america");
    expect(screen.queryByRole("radio", { name: "경제" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "종합" })).toBeChecked();
  });

  it("saves the selection", async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole("radio", { name: "경제" }));
    await userEvent.click(feedList().getByRole("checkbox", { name: /매일경제/ }));
    await userEvent.clear(screen.getByLabelText("기사 수"));
    await userEvent.type(screen.getByLabelText("기사 수"), "15");
    await userEvent.type(screen.getByLabelText("제목"), "경제 브리핑");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith({
      title: "경제 브리핑",
      country: "KR",
      category: "economy",
      feedIds: feedsFor("KR", "economy").map((f) => f.id).filter((id) => id !== "kr-mk-economy"),
      customUrls: [],
      limit: 15,
    });
  });

  it("disables save when nothing is selected", async () => {
    setup();
    for (const box of feedList().getAllByRole("checkbox")) await userEvent.click(box);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("finds feeds from a site address and adds the chosen one as a custom url", async () => {
    const { discover, onSave } = setup();
    await userEvent.type(screen.getByLabelText("RSS 또는 사이트 주소"), "example.com");
    await userEvent.click(screen.getByRole("button", { name: "찾기" }));
    expect(discover).toHaveBeenCalledWith("example.com");
    await userEvent.click(await screen.findByRole("button", { name: /Example Feed 추가/ }));
    expect(screen.getByText("https://example.com/rss")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].customUrls).toEqual(["https://example.com/rss"]);
  });

  it("adds a catalog outlet found from its site as a catalog feed", async () => {
    const discover = vi.fn(async (): Promise<DiscoverResult> => ({ feeds: [{ url: "https://feeds.bbci.co.uk/news/rss.xml", title: "BBC News · 종합", catalogId: "gb-bbc-top" }] }));
    const { onSave } = setup({ discover });
    await userEvent.type(screen.getByLabelText("RSS 또는 사이트 주소"), "bbc.com{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: /BBC News · 종합 추가/ }));
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].feedIds).toContain("gb-bbc-top");
    expect(onSave.mock.calls[0][0].customUrls).toEqual([]);
  });

  it("shows the discovery error", async () => {
    setup({ discover: vi.fn(async (): Promise<DiscoverResult> => ({ feeds: [], error: "RSS를 찾지 못했습니다" })) });
    await userEvent.type(screen.getByLabelText("RSS 또는 사이트 주소"), "https://example.com/page{Enter}");
    expect(await screen.findByText("RSS를 찾지 못했습니다")).toBeInTheDocument();
  });

  it("saves a keyword-only panel without a country", async () => {
    const { onSave } = setup();
    for (const box of feedList().getAllByRole("checkbox")) await userEvent.click(box);
    await userEvent.type(screen.getByLabelText("키워드 (구글 뉴스)"), "반도체");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    const value = onSave.mock.calls[0][0];
    expect(value).toMatchObject({ query: "반도체", feedIds: [], customUrls: [] });
    expect(value.country).toBeUndefined();
    expect(value.category).toBeUndefined();
  });

  it("closes on cancel and Escape", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not show a delete button when adding", () => {
    setup();
    expect(screen.queryByRole("button", { name: "패널 삭제" })).not.toBeInTheDocument();
  });
});

describe("PanelEditor — edit", () => {
  const panel: Panel = {
    id: "p1",
    title: "내 패널",
    country: "CN",
    category: "top",
    feedIds: ["cn-scmp-top", "cn-globaltimes-top"],
    customUrls: ["https://custom.example.com/rss"],
    limit: 20,
  };

  it("loads the panel values", () => {
    setup({ panel });
    expect(screen.getByRole("dialog", { name: "패널 편집" })).toBeInTheDocument();
    expect(screen.getByLabelText("대륙")).toHaveValue("asia");
    expect(screen.getByLabelText("나라")).toHaveValue("CN");
    expect(screen.getByLabelText("제목")).toHaveValue("내 패널");
    expect(screen.getByLabelText("기사 수")).toHaveValue(20);
    expect(feedList().getByRole("checkbox", { name: /South China Morning Post/ })).toBeChecked();
    expect(feedList().getByRole("checkbox", { name: /CGTN/ })).not.toBeChecked();
    expect(screen.getByText("https://custom.example.com/rss")).toBeInTheDocument();
  });

  it("lists feeds that are no longer provided and lets the user remove them", async () => {
    const { onSave } = setup({ panel });
    expect(screen.getByText(/더 이상 제공되지 않는 매체/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "삭제: cn-globaltimes-top" }));
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].feedIds).toEqual(["cn-scmp-top"]);
  });

  it("keeps stale ids if the user does not remove them", async () => {
    const { onSave } = setup({ panel });
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].feedIds).toEqual(["cn-scmp-top", "cn-globaltimes-top"]);
  });

  it("removes a custom url", async () => {
    const { onSave } = setup({ panel });
    await userEvent.click(screen.getByRole("button", { name: "삭제: https://custom.example.com/rss" }));
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].customUrls).toEqual([]);
  });

  it("deletes the panel", async () => {
    const { onDelete } = setup({ panel });
    await userEvent.click(screen.getByRole("button", { name: "패널 삭제" }));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe("PanelEditor — limits", () => {
  it("caps the total number of feeds at 12", async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText("대륙"), "north-america");
    await userEvent.click(screen.getByRole("radio", { name: "전체" }));
    const boxes = feedList().getAllByRole("checkbox");
    expect(boxes.filter((b) => (b as HTMLInputElement).checked)).toHaveLength(12);
    expect(boxes.filter((b) => !(b as HTMLInputElement).checked).every((b) => (b as HTMLInputElement).disabled)).toBe(true);
    expect(screen.getByText("12/12")).toBeInTheDocument();
  });
});
