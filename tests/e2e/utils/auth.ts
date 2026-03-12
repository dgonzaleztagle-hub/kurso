import { Page, expect } from "@playwright/test";

const DEFAULT_E2E_EMAIL = "e2e.audit.kurso@gmail.com";
const DEFAULT_E2E_PASSWORD = "KursoAudit2026!";
const DEFAULT_E2E_MASTER_EMAIL = "e2e.master.kurso@gmail.com";
const DEFAULT_E2E_MASTER_PASSWORD = "KursoMaster2026!";

export function getE2ECreds() {
  const email = process.env.E2E_EMAIL || process.env.E2E_AUTO_EMAIL || DEFAULT_E2E_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.E2E_AUTO_PASSWORD || DEFAULT_E2E_PASSWORD;
  return { email, password, enabled: Boolean(email && password) };
}

function getE2EMasterCreds() {
  const email = process.env.E2E_MASTER_EMAIL || DEFAULT_E2E_MASTER_EMAIL;
  const password = process.env.E2E_MASTER_PASSWORD || DEFAULT_E2E_MASTER_PASSWORD;
  return { email, password, enabled: Boolean(email && password) };
}

async function ensureUser(email: string, password: string, fullName: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        full_name: fullName,
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

async function getUserIdByPasswordGrant(email: string, password: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey || !email || !password) return null;

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { user?: { id?: string | null } };
  return json.user?.id || null;
}

async function ensureMasterMembershipForOwnerTenant() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return;

  const ownerCreds = getE2ECreds();
  const masterCreds = getE2EMasterCreds();
  const ownerId = await getUserIdByPasswordGrant(ownerCreds.email, ownerCreds.password);
  const masterId = await getUserIdByPasswordGrant(masterCreds.email, masterCreds.password);
  if (!ownerId || !masterId) return;

  const listRes = await fetch(
    `${url}/rest/v1/tenant_members?user_id=eq.${ownerId}&status=eq.active&select=tenant_id`,
    {
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
    }
  );

  if (!listRes.ok) return;
  const rows = (await listRes.json()) as Array<{ tenant_id: string }>;

  for (const row of rows) {
    await fetch(`${url}/rest/v1/tenant_members?on_conflict=tenant_id,user_id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        tenant_id: row.tenant_id,
        user_id: masterId,
        role: "master",
        status: "active",
      }),
    });
  }
}

export async function login(page: Page) {
  const { email, password, enabled } = getE2ECreds();
  if (!enabled) {
    return false;
  }

  await ensureUser(email!, password!, "E2E Audit User");

  await page.goto("/auth?mode=login");
  await page.getByLabel("Correo Electrónico o RUT").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.waitForTimeout(1200);

  if (page.url().includes("/auth")) {
    return false;
  }

  // First-login tenant bootstrap through onboarding if needed
  if (page.url().includes("/onboarding")) {
    try {
      const institutionById = page.locator("#institutionName");
      const courseById = page.locator("#courseName");

      if (await institutionById.count()) {
        await institutionById.first().fill("Colegio E2E Kurso");
      } else if (await page.getByLabel(/colegio/i).count()) {
        await page.getByLabel(/colegio/i).first().fill("Colegio E2E Kurso");
      } else if (await page.getByPlaceholder(/colegio/i).count()) {
        await page.getByPlaceholder(/colegio/i).first().fill("Colegio E2E Kurso");
      }

      if (await courseById.count()) {
        await courseById.first().fill("Curso E2E 2026");
      } else if (await page.getByLabel(/curso/i).count()) {
        await page.getByLabel(/curso/i).first().fill("Curso E2E 2026");
      } else if (await page.getByPlaceholder(/4to|curso/i).count()) {
        await page.getByPlaceholder(/4to|curso/i).first().fill("Curso E2E 2026");
      }

      if (await page.getByRole("button", { name: /comenzar ahora/i }).count()) {
        await page.getByRole("button", { name: /comenzar ahora/i }).first().click();
      } else if (await page.getByRole("button", { name: /crear mi curso oficial/i }).count()) {
        if (await page.getByLabel(/nombre completo/i).count()) {
          await page.getByLabel(/nombre completo/i).first().fill("E2E Audit User");
        }
        if (await page.getByLabel(/whatsapp/i).count()) {
          await page.getByLabel(/whatsapp/i).first().fill("+56911112222");
        }
        await page.getByRole("button", { name: /crear mi curso oficial/i }).first().click();
      }

      await page.waitForLoadState("networkidle");
    } catch {
      return false;
    }
  }

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page).not.toHaveURL(/\/onboarding/);
  return true;
}

export async function loginMaster(page: Page) {
  const owner = getE2ECreds();
  const master = getE2EMasterCreds();
  if (!owner.enabled || !master.enabled) return false;

  await ensureUser(owner.email!, owner.password!, "E2E Audit User");
  await ensureUser(master.email!, master.password!, "E2E Master User");

  // Ensure owner has tenant first
  await login(page);
  await ensureMasterMembershipForOwnerTenant();

  // Switch to master user session
  await page.goto("/auth?mode=login");
  await page.getByLabel("Correo Electrónico o RUT").fill(master.email!);
  await page.getByLabel("Contraseña").fill(master.password!);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.waitForTimeout(1200);

  if (page.url().includes("/auth")) {
    return false;
  }

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page).not.toHaveURL(/\/onboarding/);
  return true;
}
