import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`login uses shared navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("http://localhost:3000/access");
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.locator("#shelters, #ride-request")).toHaveCount(0);
    await page.getByRole("link", { name: "Wayfinder home", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });
}
