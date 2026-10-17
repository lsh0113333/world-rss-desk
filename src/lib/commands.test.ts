import { describe, expect, it } from "vitest";
import type { Layout } from "@/types/layout";
import { searchCommands } from "./commands";

const layout: Layout = {
  version: 1,
  panels: [{ id: "p1", country: "KR", category: "economy", feedIds: ["kr-yonhap-economy"], customUrls: [], limit: 10 }],
  boards: [
    { id: "main", name: "내 화면" },
    { id: "b2", name: "테크" },
  ],
};

const labels = (q: string) => searchCommands(q, layout).map((c) => c.label);

describe("searchCommands", () => {
  it("suggests actions when the query is empty", () => {
    const l = labels("");
    expect(l).toContain("모두 확인");
    expect(l).toContain("전체 새로고침");
  });

  it("finds existing panels to jump to", () => {
    expect(searchCommands("한국", layout)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "jump", panelId: "p1" })]));
  });

  it("offers country × category panels by Korean name", () => {
    const cmds = searchCommands("미국 경제", layout);
    expect(cmds[0]).toMatchObject({ kind: "add", country: "US", category: "economy", label: "패널 추가: 🇺🇸 미국 · 경제" });
  });

  it("offers every available category for a country query", () => {
    const adds = searchCommands("일본", layout).filter((c) => c.kind === "add");
    expect(adds.map((c) => (c.kind === "add" ? c.category : null))).toEqual(expect.arrayContaining(["top", "economy"]));
  });

  it("matches countries by code and category alone", () => {
    expect(searchCommands("gb", layout).some((c) => c.kind === "add" && c.country === "GB")).toBe(true);
    expect(searchCommands("IT", layout).some((c) => c.kind === "add" && c.category === "tech")).toBe(true);
  });

  it("finds outlets and builds a panel from all their feeds", () => {
    const bbc = searchCommands("bbc", layout).find((c) => c.kind === "outlet");
    expect(bbc).toMatchObject({ label: "매체 패널 추가: BBC News" });
    expect(bbc && bbc.kind === "outlet" ? bbc.feedIds.length : 0).toBeGreaterThan(3);
  });

  it("switches boards and offers a new board", () => {
    expect(searchCommands("테크", layout)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "board", boardId: "b2" })]));
    expect(labels("보드")).toContain("새 보드 만들기");
  });

  it("limits the number of results", () => {
    expect(searchCommands("a", layout).length).toBeLessThanOrEqual(10);
  });
});
