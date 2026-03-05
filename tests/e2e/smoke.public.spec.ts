import { test, expect } from "@playwright/test";

test("auth page renders", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByLabel("Correo Electrónico o RUT")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
});
