import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageToggle, LocaleProvider, useLocale } from "@/components/locale-provider";

function Sample() {
  const { t } = useLocale();
  return <><LanguageToggle /><p>{t("heroDescription")}</p></>;
}

describe("LanguageToggle", () => {
  it("switches the interface to Chinese and persists the choice", () => {
    window.localStorage.clear();
    render(<LocaleProvider><Sample /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByText("为一天中最美的时刻，准备的一份小小预报。")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(window.localStorage.getItem("afterglow:locale")).toBe("zh");
  });
});
