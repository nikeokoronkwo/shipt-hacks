import { expect, test } from "@playwright/test";

test("backend shelters can be selected through to the pickup form", async ({ page, request }) => {
  const response = await request.get("http://localhost:8000/api/shelters");
  expect(response.ok()).toBeTruthy();
  const shelters = await response.json() as { id: number; name: string; available_beds: number }[];
  const available = shelters.filter(shelter => shelter.available_beds > 0);
  expect(available.length).toBeGreaterThan(0);
  await page.goto("http://localhost:3000/find-shelter");
  for (const shelter of available) {
    await expect(page.locator(`a[href="/shelter-details/${shelter.id}"]`).first()).toBeVisible();
  }
  const first = available[0];
  await page.locator(`a[href="/shelter-details/${first.id}"]`).first().click();
  await expect(page.getByRole("heading", { name: first.name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request pickup", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Share my current location" })).toBeVisible();
});

test("query parameters render without instant-navigation URL errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://localhost:3000/find-shelter?q=Northside");
  await expect(page.getByRole("textbox", { name: "Search shelters" })).toHaveValue("Northside");
  await expect(page.getByRole("link", { name: /Northside Night Shelter/ }).first()).toBeVisible();
  expect(errors.filter(error => /instant-shell-url-data|URL data during prerendering|outside of.*Suspense/.test(error))).toEqual([]);
});
