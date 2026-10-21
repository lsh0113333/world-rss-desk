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
  it("가판대: 상단 바에 이름, 불러오는 동안 자리 표시", () => {
    render(<Home />);
    expect(screen.getByRole("banner")).toHaveTextContent("세계 가판대");
    expect(screen.getByLabelText("불러오는 중")).toBeInTheDocument();
  });
});
