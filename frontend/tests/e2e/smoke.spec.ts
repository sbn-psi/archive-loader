import { test, expect } from "@playwright/test";

test("legacy app still redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
});
