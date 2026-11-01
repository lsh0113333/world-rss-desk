import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("오늘의 세계: 제목, 불러오는 동안 자리 표시", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("오늘의 세계");
    expect(screen.getByLabelText("불러오는 중")).toBeInTheDocument();
  });
});
