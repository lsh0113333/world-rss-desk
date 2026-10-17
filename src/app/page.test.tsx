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
  it("renders the app name in the top bar", () => {
    render(<Home />);
    expect(screen.getByRole("banner")).toHaveTextContent("World RSS Desk");
  });
});
