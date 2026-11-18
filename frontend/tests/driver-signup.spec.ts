import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const apiURL = "http://localhost:8000";
const vehicle = { vehicle_make: "Toyota", vehicle_model: "Prius", vehicle_color: "Blue", license_plate: "E2E 1234" };

// Keep production OTP limits enabled while simulating independent clients.
// Scope this header to same-origin auth: adding it to API requests would create
// an unsupported cross-origin CORS request header.
test.beforeEach(async ({ page }, testInfo) => {
  await page.route("**/api/auth/phone-number/send-otp", route => route.continue({
    headers: { ...route.request().headers(), "x-forwarded-for": `198.18.${Math.floor(testInfo.line / 256)}.${testInfo.line % 256}` },
  }));
});

async function deliveredCode(phone: string) {
  let code = "";
  await expect.poll(() => {
    try {
      const messages = readFileSync(process.env.SHELTERCONNECT_E2E_SMS_FILE!, "utf8")
        .trim().split("\n").map(line => JSON.parse(line) as { to: string; body: string });
      code = messages.filter(message => message.to === phone).at(-1)?.body.match(/code is (\d{6})/)?.[1] ?? "";
    } catch { code = ""; }
    return code.length;
  }).toBe(6);
  return code;
}

async function accessToken(page: Page) {
  const response = await page.request.get("/api/auth/token");
  expect(response.status()).toBe(200);
  const { token } = await response.json() as { token: string };
  expect(token).toBeTruthy();
  return token;
}

async function savedProfile(page: Page) {
  const token = await accessToken(page);
  const response = await page.request.get(`${apiURL}/api/drivers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{
    id: number; auth_user_id: string; phone_number: string;
    sms_notifications_enabled: boolean; is_available: boolean; is_verified: boolean;
    vehicle_make: string; vehicle_model: string; vehicle_color: string; license_plate: string;
  }>;
}

async function sessionUser(page: Page) {
  const response = await page.request.get("/api/auth/get-session?disableCookieCache=true");
  expect(response.status()).toBe(200);
  const session = await response.json() as { user: { id: string; name: string; role: string } };
  return session.user;
}

async function fillVehicle(page: Page) {
  await page.getByLabel("Make", { exact: true }).fill(vehicle.vehicle_make);
  await page.getByLabel("Model", { exact: true }).fill(vehicle.vehicle_model);
  await page.getByLabel("Color", { exact: true }).fill(vehicle.vehicle_color);
  await page.getByLabel("License plate", { exact: true }).fill(vehicle.license_plate);
}

async function verifySms(page: Page, phone: string) {
  await expect(page.getByLabel("SMS code", { exact: true })).toBeVisible();
  await page.getByLabel("SMS code", { exact: true }).fill(await deliveredCode(phone));
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
}

test("homepage email signup resumes setup, retries the API, and persists vehicle and consent", async ({ page }) => {
  const phone = "+12055550101";
  await page.goto("/");
  await page.getByRole("link", { name: "Sign up to drive" }).click();
  await expect(page).toHaveURL(/\/become-a-driver$/);
  await page.getByLabel("Full name", { exact: true }).fill("Email Volunteer");
  await page.getByLabel("Email address", { exact: true }).fill("email-volunteer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("A-long-test-password-123!");
  await page.getByRole("button", { name: "Create driver account", exact: true }).click();
  await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible();
  const identity = await sessionUser(page);
  expect(identity).toMatchObject({ name: "Email Volunteer", role: "driver" });

  // The account survives leaving setup before a backend profile exists.
  await page.reload();
  await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create driver account", exact: true })).toHaveCount(0);
  expect(await sessionUser(page)).toEqual(identity);
  await expect(page.getByRole("button", { name: "Send verification code", exact: true })).toHaveCount(0);
  await page.getByLabel("Phone number", { exact: true }).fill(phone);
  await fillVehicle(page);
  const consent = page.getByRole("checkbox", { name: /Text me when new ride requests/ });
  await expect(consent).not.toBeChecked();
  await consent.check();

  // Only the failure is injected. The subsequent successful request exercises
  // real auth cookies, JWT issuance, JWKS verification, FastAPI and SQLite.
  await page.route("**/api/drivers/me/initialize", route => route.abort("connectionfailed"));
  await page.getByRole("button", { name: "Save driver profile", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open driver dashboard", exact: true })).toHaveCount(0);
  await expect(consent).toBeChecked();
  await expect(page.getByLabel("License plate", { exact: true })).toHaveValue(vehicle.license_plate);
  await expect(page.getByRole("button", { name: "Save driver profile", exact: true })).toBeEnabled();
  await page.unroute("**/api/drivers/me/initialize");
  await page.getByRole("button", { name: "Save driver profile", exact: true }).click();
  await expect(page.getByText("Driver profile saved", { exact: false })).toBeVisible();
  const profile = await savedProfile(page);
  expect(profile).toMatchObject({ ...vehicle, auth_user_id: identity.id, phone_number: phone, sms_notifications_enabled: true, is_verified: true, is_available: false });
  await page.getByRole("link", { name: "Open driver dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Volunteer driver dashboard" })).toBeVisible();
  await expect(page.getByText(`Verified driver · ${phone}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Online · Accepting requests/ })).toBeEnabled();
  const dashboardConsent = page.getByRole("checkbox", { name: "Opt in to new-ride SMS alerts" });
  await expect(dashboardConsent).toBeChecked();
  // The controlled dashboard preference changes only after the API confirms
  // persistence, so wait for its new state rather than requiring a synchronous
  // native checkbox toggle.
  await dashboardConsent.click();
  await expect(dashboardConsent).not.toBeChecked();
  await expect(dashboardConsent).toBeEnabled();
  await expect.poll(async () => (await savedProfile(page)).sms_notifications_enabled).toBe(false);
  await page.reload();
  await expect(dashboardConsent).not.toBeChecked();
  const updatedProfile = { ...profile, sms_notifications_enabled: false };
  expect(await savedProfile(page)).toEqual(updatedProfile);

  // Revisiting setup recognizes the stored profile without resetting contact,
  // vehicle, or consent, or creating a second application profile.
  await page.goto("/become-a-driver");
  await expect(page.getByRole("link", { name: "Open driver dashboard", exact: true })).toBeVisible();
  expect(await savedProfile(page)).toEqual(updatedProfile);
});

test("SMS signup saves a new name, keeps alerts off, and preserves the name on returning signup", async ({ page }) => {
  const phone = "+12055550102";
  await page.goto("/become-a-driver");
  await page.getByRole("button", { name: "Phone by SMS", exact: true }).click();
  await page.getByLabel(/Full name/).fill("SMS Volunteer");
  await page.getByLabel("Mobile number", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await expect(page.getByLabel("SMS code", { exact: true })).toBeVisible();
  const code = await deliveredCode(phone);
  await page.getByLabel("SMS code", { exact: true }).fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save driver profile", exact: true })).toHaveCount(0);
  await page.getByLabel("SMS code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveValue(phone);
  expect(await sessionUser(page)).toMatchObject({ name: "SMS Volunteer", role: "driver" });
  await fillVehicle(page);
  await expect(page.getByRole("checkbox", { name: /Text me when new ride requests/ })).not.toBeChecked();
  await page.getByRole("button", { name: "Save driver profile", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open driver dashboard", exact: true })).toBeVisible();
  const profile = await savedProfile(page);
  expect(profile).toMatchObject({ ...vehicle, phone_number: phone, sms_notifications_enabled: false, is_verified: true, is_available: false });
  await page.getByRole("link", { name: "Open driver dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();

  // Phone verification also signs existing users in. Optional signup input
  // must not silently rename a returning account.
  await page.goto("/become-a-driver");
  await page.getByRole("button", { name: "Phone by SMS", exact: true }).click();
  await page.getByLabel(/Full name/).fill("Do not overwrite the saved name");
  await page.getByLabel("Mobile number", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await verifySms(page, phone);
  await expect(page.getByRole("link", { name: "Open driver dashboard", exact: true })).toBeVisible();
  expect(await sessionUser(page)).toMatchObject({ name: "SMS Volunteer" });
  expect(await savedProfile(page)).toEqual(profile);

  await page.getByRole("link", { name: "Open driver dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
  await page.goto("/access");
  await page.getByRole("button", { name: "SMS code", exact: true }).click();
  await page.getByLabel("Mobile number", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
  await expect(page.getByLabel("SMS code", { exact: true })).toBeVisible();
  await page.getByLabel("SMS code", { exact: true }).fill(await deliveredCode(phone));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/driver-profile$/);
  await expect(page.getByRole("checkbox", { name: "Opt in to new-ride SMS alerts" })).not.toBeChecked();
  expect(await savedProfile(page)).toEqual(profile);
});

test("SMS delivery failure stays retryable and never claims a verification code was sent", async ({ page }) => {
  await page.goto("/become-a-driver");
  await page.getByRole("button", { name: "Phone by SMS", exact: true }).click();
  await page.getByLabel("Mobile number", { exact: true }).fill("+12055550103");
  const rejected = page.waitForResponse(response => response.url().endsWith("/api/auth/phone-number/send-otp"));
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  expect((await rejected).status()).toBe(503);
  await expect(page.locator("main [role=alert]")).toContainText("couldn't send your verification code");
  await expect(page.getByText("Code sent. It expires in five minutes.", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("SMS code", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send verification code", exact: true })).toBeEnabled();
  await page.getByLabel("Mobile number", { exact: true }).fill("+12055550104");
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await expect(page.getByLabel("SMS code", { exact: true })).toBeVisible();
  expect(await deliveredCode("+12055550104")).toMatch(/^\d{6}$/);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("the API permits the configured browser origin and rejects an unrelated origin", async ({ request }) => {
  const headers = {
    Origin: "http://localhost:3000",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
  };
  const allowed = await request.fetch(`${apiURL}/api/drivers/me/initialize`, { method: "OPTIONS", headers });
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()["access-control-allow-origin"]).toBe("http://localhost:3000");
  const rejected = await request.fetch(`${apiURL}/api/drivers/me/initialize`, {
    method: "OPTIONS", headers: { ...headers, Origin: "https://unrelated.example" },
  });
  expect(rejected.status()).toBe(400);
  expect(rejected.headers()["access-control-allow-origin"]).toBeUndefined();
});
