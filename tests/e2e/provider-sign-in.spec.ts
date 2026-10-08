import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("provider failure retains the destination and local sign-in remains available", async ({ page }, info) => {
  const destination = "/?board=TCK&status=ready";
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  const provider = page.getByRole("button", { name: "Continue with Test organization", exact: true });
  await expect(provider).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local account" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.route("**/api/auth/sign-in/oauth2", async route => {
    const body = route.request().postDataJSON();
    expect(body.providerId).toBe("test-sso");
    expect(body.callbackURL).toBe(destination);
    expect(body.errorCallbackURL).toContain(encodeURIComponent(destination));
    await route.fulfill({ status: 503, json: { code: "UNAVAILABLE", message: "Provider unavailable" } });
  });
  await provider.click();
  await expect(page.locator(".auth-form").getByRole("alert")).toContainText("use your local account");
  await expect(provider).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("provider-recovery.png") });
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("board=TCK&status=ready"));
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
});
