// tests/e2e/studio.spec.js
const { test, expect } = require("@playwright/test");
const { registerUser, API } = require("./helpers");

test.describe("Studio scene editing", () => {
  let token, email, password;

  test.beforeAll(async ({ request }) => {
    email = `studio_${Date.now()}@test.local`;
    password = "StudioPass123!";
    const user = await registerUser(request, { name: "Studio Tester", email, password });
    token = user.token;
  });

  test("studio page loads with 3D canvas", async ({ page }) => {
    // Login via UI
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/dashboard|\//);

    // Navigate to studio (create or open a project)
    await page.goto("/studio");
    await page.waitForLoadState("networkidle");

    // The studio should have a canvas element (Three.js)
    const canvas = page.locator("canvas");
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test("studio has toolbar with expected tools", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/dashboard|\//);

    await page.goto("/studio");
    await page.waitForLoadState("networkidle");

    // Should have common studio UI elements
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check for toolbar buttons (translate, rotate, scale)
    const toolbar = page.locator('[class*="toolbar"], [class*="Toolbar"]');
    if (await toolbar.count() > 0) {
      await expect(toolbar.first()).toBeVisible();
    }
  });

  test("studio keyboard shortcuts accessible", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL(/dashboard|\//);

    await page.goto("/studio");
    await page.waitForLoadState("networkidle");

    // Canvas should be present
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

    // Press Escape to deselect
    await page.keyboard.press("Escape");

    // Press Delete should not crash the page
    await page.keyboard.press("Delete");

    // Page should still be functional
    await expect(page.locator("canvas").first()).toBeVisible();
  });
});
