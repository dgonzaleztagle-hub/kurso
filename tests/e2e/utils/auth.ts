import { Page, expect } from "@playwright/test";

const DEFAULT_E2E_EMAIL = "e2e.audit.kurso@gmail.com";
const DEFAULT_E2E_PASSWORD = "KursoAudit2026!";

export function getE2ECreds() {
  const email = process.env.E2E_EMAIL || process.env.E2E_AUTO_EMAIL || DEFAULT_E2E_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.E2E_AUTO_PASSWORD || DEFAULT_E2E_PASSWORD;
  return { email, password, enabled: Boolean(email && password) };
}

async function ensureE2EUser() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { email, password } = getE2ECreds();

  if (!url || !serviceRole || !email || !password) {
    return;
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "E2E Audit User",
      },
    }),
  });

  if (res.ok) return;

  const text = await res.text();
  if (
    text.toLowerCase().includes("already") ||
    text.toLowerCase().includes("exists") ||
    res.status === 422
  ) {
    return;
  }

  throw new Error(`Could not ensure E2E user: ${res.status} ${text}`);
}

export async function login(page: Page) {
  const { email, password, enabled } = getE2ECreds();
  if (!enabled) {
    return false;
  }

  await ensureE2EUser();

  await page.goto("/auth?mode=login");
  await page.getByLabel("Correo Electrónico o RUT").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();

  // First-login tenant bootstrap through onboarding if needed
  if (page.url().includes("/onboarding")) {
    await page.getByPlaceholder("Ej: Colegio San Agustín").fill("Colegio E2E Kurso");
    await page.getByPlaceholder("Ej: 4to Medio A 2025").fill("Curso E2E 2026");
    await page.getByRole("button", { name: /comenzar ahora/i }).click();
    await page.waitForLoadState("networkidle");
  }

  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page).not.toHaveURL(/\/onboarding/);
  return true;
}
