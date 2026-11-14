import { expect, test } from "@playwright/test";

const URL = "http://localhost:3000/shelter-details/1";

test("shared location supplies both coordinates and makes the address optional", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 33.5207, longitude: -86.8025 });
  await page.goto(URL);
  await page.getByRole("button", { name: "Share my current location" }).click();
  await expect(page.getByText(/Location selected:/)).toContainText("33.52070, -86.80250");
  await expect(page.locator('[name="pickup_address"]')).not.toHaveAttribute("required");
  await page.locator('[name="first_name"]').fill("Location");
  await page.locator('[name="last_name"]').fill("Test");
  const requestPayload = new Promise<Record<string, unknown>>(resolve => {
    void page.route("**/api/rides", async route => {
      resolve(route.request().postDataJSON());
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ detail: "Test request intercepted; no ride created." }) });
    });
  });
  await page.getByRole("button", { name: "Request pickup", exact: true }).click();
  expect(await requestPayload).toEqual({ first_name: "Location", last_name: "Test", shelter_id: 1, pickup_latitude: 33.5207, pickup_longitude: -86.8025 });
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator('[name="pickup_address"]')).toHaveAttribute("required", "");
});

test("a browser that never invokes the location callback does not leave the button stuck", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition() {} }, configurable: true });
  });
  await page.clock.install();
  await page.goto(URL);
  await page.getByRole("button", { name: "Share my current location" }).click();
  await page.clock.fastForward(20000);
  await expect(page.locator('fieldset [role="alert"]')).toContainText(/timed out/i);
  await expect(page.getByRole("button", { name: "Share my current location" })).toBeEnabled();
  await expect(page.locator('[name="pickup_address"]')).toHaveAttribute("required", "");
});

for (const code of [1, 2, 3]) {
  test(`location failure ${code} shows recovery instructions and permits retry`, async ({ page }) => {
    await page.addInitScript(code => {
      Object.defineProperty(navigator, "geolocation", { value: {
        getCurrentPosition(_success: PositionCallback, failure: PositionErrorCallback) { failure({ code } as GeolocationPositionError); },
      }, configurable: true });
    }, code);
    await page.goto(URL);
    await page.getByRole("button", { name: "Share my current location" }).click();
    await expect(page.locator('fieldset [role="alert"]')).toContainText(code === 1 ? /permission/i : code === 2 ? /Location Services/i : /timed out/i);
    await expect(page.getByRole("button", { name: "Share my current location" })).toBeEnabled();
    await expect(page.locator('[name="pickup_address"]')).toHaveAttribute("required", "");
  });
}
