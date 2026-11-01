import { render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorProfile } from "@/types/world";
import { ActorView } from "./ActorView";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

const profile: ActorProfile = {
  id: "country:US",
  name: "United States",
  nameKo: "미국",
  kind: "country",
  events: [{ id: "event:1", title: "미국, 중국 제재", summary: "미국이 중국을 제재했다.", type: "sanction", role: "subject", lastSeenAt: new Date().toISOString() }],
  together: [{ id: "actor:org:un", nameKo: "유엔", kind: "org", count: 3 }],
};

function renderActor(id = "country:US") {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <ActorView id={id} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => json(profile));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ActorView", () => {
  it("행위자의 사건과 역할, 함께 나온 행위자를 보여 준다", async () => {
    renderActor();
    expect(await screen.findByRole("heading", { level: 1, name: "미국" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/actors?id=${encodeURIComponent("country:US")}`);
    const events = screen.getByRole("region", { name: "나온 사건" });
    expect(within(events).getByText("미국, 중국 제재")).toBeInTheDocument();
    expect(within(events).getByText("미국이 중국을 제재했다.")).toBeInTheDocument();
    expect(within(events).getByText(/주체 · 제재·압박/)).toBeInTheDocument();
    const together = screen.getByRole("region", { name: "함께 나온 행위자" });
    const link = within(together).getByRole("link", { name: /유엔/ });
    expect(link).toHaveAttribute("href", `/actors/${encodeURIComponent("actor:org:un")}`);
    expect(link).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "오늘의 세계" })).toHaveAttribute("href", "/");
  });

  it("없는 행위자", async () => {
    fetchMock.mockImplementation(() => json({ error: "x" }, 404));
    renderActor("actor:org:none");
    expect(await screen.findByText("이 행위자는 최근 30일 사건에 나오지 않았어요")).toBeInTheDocument();
  });

  it("실패", async () => {
    fetchMock.mockImplementation(() => json({ error: "x" }, 502));
    renderActor();
    expect(await screen.findByText("불러오지 못했습니다")).toBeInTheDocument();
  });
});
