import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppDownloads } from "@/components/app-downloads";
import { LanguageToggle, LocaleProvider } from "@/components/locale-provider";

function renderDownloads() {
  render(<LocaleProvider><LanguageToggle /><AppDownloads /></LocaleProvider>);
}

describe("AppDownloads", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_IPHONE_APP_STORE_LIVE", "0");
    vi.stubEnv("NEXT_PUBLIC_MAC_APP_STORE_LIVE", "0");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("shows both platforms without links and localizes their availability", () => {
    renderDownloads();
    const downloads = within(screen.getByRole("group", { name: "Afterglow for iPhone and Mac" }));
    expect(downloads.getByText("iPhone")).toBeInTheDocument();
    expect(downloads.getByText("Mac")).toBeInTheDocument();
    expect(downloads.getAllByText("Coming soon")).toHaveLength(2);
    expect(downloads.queryByRole("link")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(downloads.getAllByText("即将推出")).toHaveLength(2);
  });

  it("only enables the platform whose store listing is live", () => {
    vi.stubEnv("NEXT_PUBLIC_MAC_APP_STORE_LIVE", "1");
    renderDownloads();

    expect(screen.getByRole("link", { name: "Download Afterglow on the Mac App Store" }))
      .toHaveAttribute("href", "https://apps.apple.com/us/app/id6836620328?platform=mac");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /for iPhone/ })).not.toBeInTheDocument();
  });

  it("uses the default App Store page for the iPhone badge", () => {
    vi.stubEnv("NEXT_PUBLIC_IPHONE_APP_STORE_LIVE", "1");
    renderDownloads();

    expect(screen.getByRole("link", { name: "Download Afterglow for iPhone on the App Store" }))
      .toHaveAttribute("href", "https://apps.apple.com/us/app/id6836620328");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
