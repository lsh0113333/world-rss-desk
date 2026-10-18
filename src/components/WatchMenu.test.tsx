import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Mentions } from "@/lib/watch";
import { WatchMenu } from "./WatchMenu";

const now = new Date("2026-10-18T12:00:00Z");
const article = { id: "1", title: "Iran talks resume", link: "https://example.com/1", publishedAt: "2026-10-18T11:00:00Z", source: "BBC" };
const mentions: Mentions = { items: [{ article, panelId: "p" }], unread: 1 };

function setup(props: Partial<Parameters<typeof WatchMenu>[0]> = {}) {
  const handlers = { onChange: vi.fn(), onSelect: vi.fn() };
  render(<WatchMenu keywords={["Iran"]} mentions={mentions} readIds={new Set()} now={now} {...handlers} {...props} />);
  return handlers;
}

describe("WatchMenu", () => {
  it("shows the unread mention count on the button", () => {
    setup();
    expect(screen.getByRole("button", { name: "키워드 워치, 새 언급 1건" })).toHaveTextContent("1");
  });

  it("adds and removes keywords", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("button", { name: /키워드 워치/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "키워드 추가" }), "반도체{Enter}");
    expect(onChange).toHaveBeenCalledWith(["Iran", "반도체"]);
    await userEvent.click(screen.getByRole("button", { name: "Iran 삭제" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("lists mentions and opens one", async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole("button", { name: /키워드 워치/ }));
    await userEvent.click(screen.getByRole("button", { name: /Iran talks resume/ }));
    expect(onSelect).toHaveBeenCalledWith(article);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
