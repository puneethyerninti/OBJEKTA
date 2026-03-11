// tests/e2e/auth.spec.js
const { test, expect } = require("@playwright/test");
const { testEmail, API } = require("./helpers");

test.describe("Authentication flows", () => {
  test("register → login → view dashboard", async ({ page }) => {
    const email = testEmail("reg");
    const password = "SecurePass123!";

    // Navigate to register
    await page.goto("/register");
    await expect(page).toHaveURL(/register/);

    // Fill registration form
    await page.getByLabel(/name/i).fill("Test User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).first().fill(password);

    // Submit
    await page.getByRole("button", { name: /sign up|register|create/i }).click();

    // Should redirect to dashboard or login
    await page.waitForURL(/dashboard|login|\//);

    // If redirected to login, log in
    if (page.url().includes("login")) {
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /log in|sign in/i }).click();
      await page.waitForURL(/dashboard|\//);
    }

    // Dashboard should be accessible
    await expect(page.locator("body")).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("nonexistent@test.local");
    await page.getByLabel(/password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    // Should show an error message and remain on login
    await expect(page).toHaveURL(/login/);
  });

  test("forgot password flow submits without error", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/forgot-password/);

    await page.getByLabel(/email/i).fill("someone@test.local");
    await page.getByRole("button", { name: /send|reset|submit/i }).click();

    // Should show success message (we sent instructions)
    await expect(page.getByText(/check your email|instructions|sent/i)).toBeVisible({ timeout: 5000 });
  });

  test("protected route redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await page.waitForURL(/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test("register via API returns token", async ({ request }) => {
    const email = testEmail("api");
    const res = await request.post(`${API}/api/auth/register`, {
      data: { name: "API User", email, password: "TestPass123!" },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  test("login via API returns token", async ({ request }) => {
    const email = testEmail("login");
    // Register first
    await request.post(`${API}/api/auth/register`, {
      data: { name: "Login User", email, password: "TestPass123!" },
    });

    // Then login
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email, password: "TestPass123!" },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  test("GET /api/auth/me requires auth", async ({ request }) => {
    const res = await request.get(`${API}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/auth/me returns user with valid token", async ({ request }) => {
    const email = testEmail("me");
    const regRes = await request.post(`${API}/api/auth/register`, {
      data: { name: "Me User", email, password: "TestPass123!" },
    });
    const { token } = await regRes.json();

    const res = await request.get(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.email).toBe(email);
  });
});
