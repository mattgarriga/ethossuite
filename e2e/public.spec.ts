import { expect, test } from "@playwright/test";
import { hasPublicEnv, PUBLIC_ENV_MSG } from "./fixtures/users";

test.describe("public pages", () => {
  test.skip(!hasPublicEnv(), PUBLIC_ENV_MSG);

  test("landing page shows the SuiteScript Migrator tile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "EthosSuite", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /SuiteScript.*Migrator/i })).toBeVisible();
  });

  test("/admin signed out returns 404", async ({ page }) => {
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toHaveCount(0);
  });

  test("/login renders email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  for (const path of ["/", "/login"]) {
    test(`no horizontal scroll at 375px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { sw, cw } = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(sw).toBeLessThanOrEqual(cw);
    });
  }
});
