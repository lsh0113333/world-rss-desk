import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import { Thumb } from "./Thumb";

const base: Article = { id: "a", title: "t", link: "https://news.example.com/a?x=1", publishedAt: null, source: "Example News" };

describe("Thumb", () => {
  it("uses the RSS image when present", () => {
    render(<Thumb article={{ ...base, image: "https://img.example.com/a.jpg" }} className="h-12 w-16" />);
    const img = screen.getByRole("presentation");
    expect(img).toHaveAttribute("src", "https://img.example.com/a.jpg");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("falls back to the og:image endpoint without an RSS image", () => {
    render(<Thumb article={base} className="h-12 w-16" />);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", `/api/thumb?url=${encodeURIComponent(base.link)}`);
  });

  it("skips the og:image lookup for Google News links", () => {
    render(<Thumb article={{ ...base, link: "https://news.google.com/rss/articles/CBMi?oc=5" }} className="h-12 w-16" />);
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("shows the outlet initial when the image fails", () => {
    render(<Thumb article={base} className="h-12 w-16" />);
    fireEvent.error(screen.getByRole("presentation"));
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("uses the first letter of Korean outlet names", () => {
    render(<Thumb article={{ ...base, source: "연합뉴스" }} className="h-12 w-16" />);
    fireEvent.error(screen.getByRole("presentation"));
    expect(screen.getByText("연")).toBeInTheDocument();
  });
});
