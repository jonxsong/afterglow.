import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkyVisualization } from "@/components/sky-visualization";

afterEach(cleanup);

describe("SkyVisualization", () => {
  it("identifies itself as an interpretation", () => {
    render(<SkyVisualization palette={["#111111", "#222222", "#333333", "#444444", "#555555"]} cloudCover={40} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/forecast interpretation/i);
    expect(screen.getByText("Forecast interpretation")).toBeInTheDocument();
    expect(screen.getByText("Move to explore")).toBeInTheDocument();
    expect(document.querySelectorAll(".cloud-layer")).toHaveLength(3);
  });

  it("responds to pointer position with parallax variables", () => {
    render(<SkyVisualization palette={["#111111", "#222222", "#333333", "#444444", "#555555"]} cloudCover={40} />);
    const sky = screen.getByRole("img");
    Object.defineProperty(sky, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 100 }) });
    fireEvent(sky, new MouseEvent("pointermove", { bubbles: true, clientX: 200, clientY: 50 }));
    expect(sky.style.getPropertyValue("--mx")).toBe("1.000");
    expect(sky.style.getPropertyValue("--my")).toBe("0.000");
  });

  it("moves the sun and changes the sky across the sunset timeline", () => {
    const palette = ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"];
    const { rerender } = render(<SkyVisualization palette={palette} cloudCover={40} timeOffsetMinutes={-90} />);
    const sky = screen.getByRole("img");
    const before = { background: sky.style.background, sun: sky.style.getPropertyValue("--sun-bottom") };
    rerender(<SkyVisualization palette={palette} cloudCover={40} timeOffsetMinutes={0} />);
    expect(sky.style.getPropertyValue("--sun-bottom")).toBe("14%");
    rerender(<SkyVisualization palette={palette} cloudCover={40} timeOffsetMinutes={90} />);
    expect(sky.style.getPropertyValue("--sun-bottom")).toBe("-22%");
    expect(sky.style.background).not.toBe(before.background);
    expect(before.sun).toBe("44%");
  });
});

