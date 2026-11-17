import { expect, test } from "@playwright/test";

test("home page presents the brand and forecast entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /view the golden hour/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /see tonight’s sky/i })).toBeVisible();
  await expect(page.getByRole("img", { name: "Sample sunset" }).first()).toBeVisible();
});

test("plays a live evening and restores a labeled forecast after the weather feed fails", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T20:00:00Z"));
  const sunset = Date.parse("2026-11-18T00:56:00Z") / 1000;
  let finishForecast!: () => void;
  const forecastPending = new Promise<void>((resolve) => { finishForecast = resolve; });
  await page.route(/\/forecast\?/, async (route) => {
    await forecastPending;
    await route.fulfill({ json: {
      hourly: { time: [sunset], cloud_cover: [45], visibility: [20000] },
      daily: { sunset: [sunset] },
    } });
  });
  await page.goto("/#forecast");
  const slider = page.getByRole("slider", { name: "Explore the evening" });
  await page.getByRole("button", { name: "Explore a sample sunset" }).click();
  await expect(page.getByRole("heading", { name: "Explore a sample sunset" })).toBeFocused();
  await expect(slider).toHaveAttribute("aria-valuetext", "6:45 PM, Sunset");
  finishForecast();
  await page.getByRole("button", { name: "Back to tonight’s forecast" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "4:56 PM, Sunset");
  await page.getByRole("button", { name: "after sunset", exact: true }).click();
  await expect(slider).toHaveValue("35");
  await expect(slider).toHaveAttribute("aria-valuetext", "5:31 PM, after sunset");
  await page.getByRole("button", { name: "Play evening" }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(35);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play evening" })).toBeVisible();

  await page.unroute(/\/forecast\?/);
  await page.route(/\/forecast\?/, (route) => route.fulfill({ status: 429 }));
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Showing the last forecast retrieved today" })).toContainText("12:00 PM");
  await expect(slider).toBeVisible();
});

test("offers an interactive example and a keyboard accessible city picker in an outage", async ({ page }) => {
  await page.route(/\/forecast\?/, (route) => route.fulfill({ status: 429 }));
  await page.goto("/#forecast");
  await expect(page.getByRole("heading", { name: "Explore a sample sunset" })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Explore the evening" });
  await expect(slider).toBeVisible();
  await slider.press("ArrowLeft");
  await expect(slider).toHaveValue("-5");

  const picker = page.getByRole("button", { name: "Change location" });
  await picker.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Where will you watch?" });
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(picker).toBeFocused();

  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByRole("slider", { name: "探索傍晚时光" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "探索一场示例日落" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("finds Tokyo from the bundled city index and presents a sourced backup forecast", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T20:00:00Z"));
  await page.route(/\/(geocoding|search)\?/, (route) => route.fulfill({ status: 429 }));
  await page.route(/\/forecast\?/, (route) => {
    const timeZone = new URL(route.request().url()).searchParams.get("timezone");
    const sunset = Date.parse(timeZone === "Asia/Tokyo" ? "2026-11-18T07:32:00Z" : "2026-11-18T00:56:00Z") / 1000;
    return route.fulfill({ headers: { "x-afterglow-weather-source": "7timer" }, json: {
      hourly: { time: [sunset], cloud_cover: [50], relative_humidity_2m: [42.5] },
      daily: { sunset: [sunset] },
    } });
  });
  await page.goto("/#forecast");
  await page.getByRole("button", { name: "Change location" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Tokyo");
  await dialog.getByRole("button", { name: /^Tokyo\b/i }).first().click();
  await expect(page.getByRole("heading", { name: /^Tokyo\b/i })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Explore the evening" })).toHaveAttribute("aria-valuetext", "4:32 PM, Sunset");
  await expect(page.getByRole("link", { name: "7Timer (NOAA GFS)" })).toBeVisible();
  await expect(page.getByText("Rain chance unavailable")).toBeVisible();
});

test("shares a selected city's forecast with a fresh visitor", async ({ page, browser }) => {
  const stubForecast = async (target: typeof page, timeZones: string[] = []) => {
    await target.clock.setFixedTime(new Date("2026-11-17T20:00:00Z"));
    await target.route(/\/forecast\?/, (route) => {
      const timeZone = new URL(route.request().url()).searchParams.get("timezone") ?? "";
      timeZones.push(timeZone);
      const sunset = Date.parse(timeZone === "Asia/Tokyo" ? "2026-11-18T07:32:00Z" : "2026-11-18T00:56:00Z") / 1000;
      return route.fulfill({ json: { hourly: { time: [sunset], cloud_cover: [50] }, daily: { sunset: [sunset] } } });
    });
  };
  await stubForecast(page);
  await page.route(/\/(geocoding|search)\?/, (route) => route.fulfill({ json: { results: [
    { name: "Tokyo", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo", country: "Japan" },
  ] } }));
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async (value: string) => sessionStorage.setItem("testClipboard", value),
  } }));
  await page.goto("/#forecast");
  await page.getByRole("button", { name: "Change location" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Tokyo");
  await page.getByRole("button", { name: /Tokyo Japan/i }).click();
  await page.getByRole("button", { name: "Share forecast" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  const shareLink = await page.evaluate(() => sessionStorage.getItem("testClipboard") ?? "");
  expect(new URL(shareLink).hash).toBe("#forecast");

  const recipient = await browser.newPage();
  try {
    const requestedTimeZones: string[] = [];
    await stubForecast(recipient, requestedTimeZones);
    await recipient.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    } }));
    await recipient.goto(shareLink);
    await expect(recipient.getByRole("heading", { name: "Tokyo" })).toBeVisible();
    await expect(recipient.getByRole("slider", { name: "Explore the evening" })).toHaveAttribute("aria-valuetext", "4:32 PM, Sunset");
    expect(requestedTimeZones).toEqual(["Asia/Tokyo"]);
    await expect.poll(() => recipient.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await recipient.getByRole("button", { name: "Share forecast" }).click();
    const manualLink = recipient.getByRole("textbox", { name: "Copy this forecast link" });
    await expect(manualLink).toBeFocused();
    await expect(manualLink).toHaveValue(shareLink);
  } finally {
    await recipient.close();
  }
});

