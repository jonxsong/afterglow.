import { expect, test } from "@playwright/test";

test("home page presents the brand and forecast entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /chase the beautiful/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /see tonight’s sky/i })).toBeVisible();
  await expect(page.getByText("Forecast interpretation").first()).toBeVisible();
});

