import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkyVisualization } from "@/components/sky-visualization";

describe("SkyVisualization", () => {
  it("identifies itself as an interpretation", () => {
    render(<SkyVisualization palette={["#111111", "#222222", "#333333", "#444444", "#555555"]} cloudCover={40} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/forecast interpretation/i);
    expect(screen.getByText("Forecast interpretation")).toBeInTheDocument();
  });
});

