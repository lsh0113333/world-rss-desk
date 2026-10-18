import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { serializeLayout } from "@/lib/layout-store";
import type { Layout } from "@/types/layout";
import { SettingsMenu } from "./SettingsMenu";

const layout: Layout = { version: 1, panels: [{ id: "a", feedIds: ["kr-yonhap-top"], customUrls: [], limit: 10 }] };

function setup() {
  const onImport = vi.fn();
  const onReset = vi.fn();
  render(<SettingsMenu layout={layout} onImport={onImport} onReset={onReset} />);
  return { onImport, onReset };
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "설정" }));
}

describe("SettingsMenu", () => {
  it("opens and closes the menu", async () => {
    setup();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("exports the layout as a JSON download", async () => {
    setup();
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "설정 내보내기" }));

    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(await blob.text()).toBe(serializeLayout(layout));
    expect(click).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("imports a valid file after confirmation", async () => {
    const { onImport } = setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openMenu();
    const file = new File([serializeLayout(layout)], "layout.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("설정 가져오기"), file);
    expect(onImport).toHaveBeenCalledWith(layout);
  });

  it("does not import when the user cancels", async () => {
    const { onImport } = setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await openMenu();
    await userEvent.upload(screen.getByLabelText("설정 가져오기"), new File([serializeLayout(layout)], "l.json"));
    expect(onImport).not.toHaveBeenCalled();
  });

  it("shows an error for an invalid file and keeps the current layout", async () => {
    const { onImport } = setup();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    await openMenu();
    await userEvent.upload(screen.getByLabelText("설정 가져오기"), new File(["{nope"], "bad.json"));
    expect(alert).toHaveBeenCalledWith("가져오기 실패: JSON 형식이 아닙니다");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("resets to the preset after confirmation", async () => {
    const { onReset } = setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "기본 구성으로 초기화" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("opens the feed status dialog", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    setup();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "피드 상태" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "피드 상태" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
