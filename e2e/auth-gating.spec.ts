import { expect, test, type Page } from "@playwright/test";
import { ADMIN_ENV_MSG, createUser, deleteUser, hasAdminEnv, type TestUser } from "./fixtures/users";

test.describe("auth and gating (DB-backed)", () => {
  test.skip(!hasAdminEnv(), ADMIN_ENV_MSG);

  const created: string[] = [];
  let pub: TestUser;
  let internal: TestUser;

  test.beforeAll(async () => {
    try {
      pub = await createUser({ role: "public" });
      created.push(pub.id);
      internal = await createUser({ role: "internal" });
      created.push(internal.id);
    } catch (e) {
      await Promise.all(created.map(deleteUser));
      throw e;
    }
  });

  test.afterAll(async () => {
    await Promise.all(created.map(deleteUser));
  });

  async function signIn(page: Page, u: { email: string; password: string }) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password").fill(u.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }

  test("public user: sees email, no Admin link, /admin is 404", async ({ page }) => {
    await signIn(page, pub);
    await expect(page.getByText(pub.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });

  test("internal user: Admin link and /admin placeholder cards", async ({ page }) => {
    await signIn(page, internal);
    await expect(page.getByText(internal.email)).toBeVisible();
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
    await expect(page.getByText("Coming in a later milestone")).toHaveCount(3);
  });

  test("sign out returns to / showing Sign in", async ({ page }) => {
    await signIn(page, pub);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await signIn(page, { email: pub.email, password: "definitely-wrong-password" });
    await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");
  });
});
