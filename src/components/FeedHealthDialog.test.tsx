import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedHealthDialog } from "./FeedHealthDialog";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDialog() {
  const onClose = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <FeedHealthDialog onClose={onClose} />
    </SWRConfig>,
  );
  return { onClose };
}

describe("FeedHealthDialog", () => {
  it("shows the summary and the failed and stale feeds", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          total: 272,
          ok: 269,
          stale: [{ id: "jp-nikkei-economy", name: "Nikkei Asia", detail: "날짜 없음" }],
          failed: [{ id: "x-a", name: "A", detail: "HTTP 403" }, { id: "x-b", name: "B", detail: "기사 0개" }],
        }),
      ),
    );
    renderDialog();
    expect(await screen.findByText(/전체 272개 중 정상/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/feed-health");
    expect(within(screen.getByRole("region", { name: "실패" })).getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: /오래됨/ })).getByText("Nikkei Asia")).toBeInTheDocument();
  });

  it("shows an error and closes on Escape", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    const { onClose } = renderDialog();
    expect(await screen.findByText("점검 결과를 불러오지 못했습니다")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
