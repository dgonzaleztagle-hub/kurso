import { Page, expect } from "@playwright/test";

export function getE2ECreds() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  return { email, password, enabled: Boolean(email && password) };
}

export async function login(page: Page) {
  const { email, password, enabled } = getE2ECreds();
  if (!enabled) {
    return false;
  }

  await page.goto("/auth?mode=login");
  await page.getByLabel("Correo Electrónico o RUT").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();

  await expect(page).not.toHaveURL(/\/auth/);
  return true;
}

