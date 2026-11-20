import { test, expect } from "@playwright/test";

/**
 * Smoke-level coverage of the pages that don't need a signed-in session
 * — enough to catch "the app doesn't even boot" regressions. Deeper
 * flows (onboarding, matching, chat) need seeded data and a signed-in
 * session (the dev-only magic-link bypass, or driving the real email
 * flow against a mail catcher) — tracked as a follow-up in PROGRESS.md
 * rather than built here, since none of it has been run even once yet.
 */

test("landing page loads and links to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /get started/i }).click();
  await expect(page).toHaveURL(/\/signin$/);
});

test("faq page lists questions", async ({ page }) => {
  await page.goto("/faq");
  await expect(page.getByText(/who can join/i)).toBeVisible();
});

test("privacy and terms pages render", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /terms of use/i })).toBeVisible();
});

test("code of conduct page lists the rules", async ({ page }) => {
  await page.goto("/conduct");
  await expect(page.getByRole("heading", { name: /code of conduct/i })).toBeVisible();
});

test("sign-in form rejects an obviously non-college email domain", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel(/college email/i).fill("someone@gmail.com");
  await page.getByRole("button", { name: /send me a link/i }).click();
  await expect(page.getByText(/doesn't look like a college email/i)).toBeVisible();
});
