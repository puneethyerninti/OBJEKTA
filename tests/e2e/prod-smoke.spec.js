const { test, expect } = require("@playwright/test");

test.describe("Production smoke", () => {
  test("home and gallery mount without runtime errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Objekta/i);
    await expect(page.getByRole("button", { name: /start free|enter studio/i })).toBeVisible();

    await page.goto("/gallery", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /creative showcase/i })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
